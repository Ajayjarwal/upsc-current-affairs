import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, createFetchMock } from 'miniflare';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

test('Google code exchange works in Workers and never follows credential-bearing redirects', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const bundle = await build({
    stdin: { resolveDir: root, contents: `
      import { googleSettings, googleUserForCode, randomToken } from './lib/google-auth.ts';
      const settings = googleSettings({
        APP_ORIGIN: 'https://notes.example.com',
        GOOGLE_CLIENT_ID: '1234567890-testclient.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'fake-test-secret-not-a-real-credential',
        GOOGLE_ALLOWED_EMAIL: 'owner@gmail.com',
      });
      export default { async fetch(request) {
        try {
          const url = new URL(request.url);
          const user = await googleUserForCode(settings, url.searchParams.get('code'), randomToken(), url.searchParams.get('nonce') ?? randomToken());
          return Response.json({ user });
        } catch (error) {
          return Response.json({ reason: error.reason, diagnostic: error.diagnostic });
        }
      }};
    ` },
    bundle: true, write: false, format: 'esm', platform: 'neutral',
    conditions: ['workerd', 'worker', 'browser'], external: ['node:*'],
  });
  const mock = createFetchMock();
  mock.disableNetConnect();
  const provider = mock.get('https://oauth2.googleapis.com');
  provider.intercept({ path: '/token', method: 'POST' })
    .reply(401, JSON.stringify({ error: 'invalid_client' }), { headers: { 'content-type': 'application/json' } });
  provider.intercept({ path: '/token', method: 'POST' })
    .reply(302, '', { headers: { location: 'https://must-not-receive-credentials.example/token' } });
  const signingKeys = await generateKeyPair('RS256');
  const nonce = 'N'.repeat(43);
  const idToken = await new SignJWT({ email: 'owner@gmail.com', email_verified: true, name: 'Owner', nonce })
    .setProtectedHeader({ alg: 'RS256', kid: 'worker-test' }).setSubject('10000000001')
    .setIssuer('https://accounts.google.com').setAudience('1234567890-testclient.apps.googleusercontent.com')
    .setIssuedAt().setExpirationTime('5m').sign(signingKeys.privateKey);
  provider.intercept({ path: '/token', method: 'POST' })
    .reply(200, JSON.stringify({ id_token: idToken }), { headers: { 'content-type': 'application/json' } });
  mock.get('https://www.googleapis.com').intercept({ path: '/oauth2/v3/certs', method: 'GET' })
    .reply(200, JSON.stringify({ keys: [{ ...await exportJWK(signingKeys.publicKey), kid: 'worker-test', alg: 'RS256', use: 'sig' }] }), { headers: { 'content-type': 'application/json' } });
  const worker = new Miniflare({ modules: true, compatibilityDate: '2026-05-15', script: bundle.outputFiles[0].text, fetchMock: mock });
  try {
    const rejectedClient = await worker.dispatchFetch('https://local.test/?code=configuration-case');
    assert.deepEqual(await rejectedClient.json(), { reason: 'configuration', diagnostic: 'token_credentials' });
    const redirect = await worker.dispatchFetch('https://local.test/?code=redirect-case');
    assert.deepEqual(await redirect.json(), { reason: 'unavailable', diagnostic: 'token_response' });
    const success = await worker.dispatchFetch(`https://local.test/?code=success-case&nonce=${nonce}`);
    assert.deepEqual(await success.json(), { user: { userId: 'google:10000000001', username: 'owner@gmail.com', email: 'owner@gmail.com', displayName: 'Owner', fullName: 'Owner' } });
    mock.assertNoPendingInterceptors();
  } finally {
    await worker.dispose();
    await mock.close();
  }
});
