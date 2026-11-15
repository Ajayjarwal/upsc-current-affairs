import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPair, SignJWT } from 'jose';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { googleSettings, googlePublicSettings, beginGoogleLogin, consumeOauthState, googleUserForCode, createSession, sessionUser, revokeSession, randomToken, tokenHash, readAuthCookie, localPreviewUser, SESSION_COOKIE, OAUTH_COOKIE, SESSION_SECONDS } from '../lib/google-auth.ts';

const environment = { APP_ORIGIN: 'https://notes.example.com', GOOGLE_CLIENT_ID: '1234567890-testclient.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret-not-a-real-credential', GOOGLE_ALLOWED_EMAIL: 'owner@gmail.com' };
const settings = googleSettings(environment);
const user = { userId: 'google:10000000001', username: 'owner@gmail.com', email: 'owner@gmail.com', displayName: 'Owner', fullName: 'Owner' };
const signingKeys = await generateKeyPair('RS256');
const keyResolver = async () => signingKeys.publicKey;
const nonce = randomToken();
async function signedIdentity(overrides = {}, signingKey = signingKeys.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: '10000000001', email: 'owner@gmail.com', email_verified: true, name: 'Owner', nonce, iat: now, exp: now + 3600, iss: 'https://accounts.google.com', aud: settings.clientId, ...overrides }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(signingKey);
}

const cookieHeaders = cookie => new Headers({ cookie: cookie.split(';')[0] });

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0001_github_auth.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../drizzle/0002_google_auth.sql', import.meta.url), 'utf8'));
  function prepared(sql, args = []) {
    return {
      bind: (...values) => prepared(sql, values),
      first: async () => sqlite.prepare(sql).get(...args) ?? null,
      run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...args) }),
    };
  }
  return { sqlite, prepare: prepared, batch: statements => Promise.all(statements.map(statement => statement.run())) };
}

test('Google authentication needs a canonical HTTPS origin, owner email and a server-side secret', () => {
  assert.equal(settings.callbackUrl, 'https://notes.example.com/auth/google/callback');
  assert.equal(googleSettings({ ...environment, GOOGLE_CLIENT_SECRET: '' }), null);
  assert.ok(googlePublicSettings({ ...environment, GOOGLE_CLIENT_SECRET: '' }));
  for (const origin of ['http://notes.example.com', 'https://user@notes.example.com', 'https://notes.example.com/path', 'https://notes.example.com?next=elsewhere', 'https://localhost']) {
    assert.equal(googleSettings({ ...environment, APP_ORIGIN: origin }), null);
  }
  assert.equal(googleSettings({ ...environment, GOOGLE_ALLOWED_EMAIL: '' }), null);
});

test('OAuth requests use PKCE and request identity only basic identity scopes', async t => {
  const db = database(); t.after(() => db.sqlite.close());
  const login = await beginGoogleLogin(db, settings, '/?subject=Economy', 1000);
  const url = new URL(login.url);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.pathname, '/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), settings.callbackUrl);
  const state = url.searchParams.get('state');
  const row = db.sqlite.prepare('SELECT * FROM auth_google_oauth_states').get();
  assert.equal(row.state_hash, await tokenHash(state));
  assert.notEqual(row.state_hash, state);
  assert.equal(url.searchParams.get('code_challenge'), Buffer.from(await tokenHash(row.verifier), 'hex').toString('base64url'));
  assert.equal(url.searchParams.get('nonce'), row.nonce);
  assert.equal(row.return_to, '/?subject=Economy');
  assert.match(login.cookie, /HttpOnly; Secure; SameSite=Lax/);
});

test('OAuth state is browser-bound, expires and is consumed only once', async t => {
  const db = database(); t.after(() => db.sqlite.close());
  const login = await beginGoogleLogin(db, settings, '/', 1000);
  const state = new URL(login.url).searchParams.get('state');
  assert.equal(await consumeOauthState(db, new Headers(), state, 1001), null);
  assert.equal(await consumeOauthState(db, cookieHeaders(`${OAUTH_COOKIE}=${randomToken()}`), state, 1001), null);
  const consumed = await consumeOauthState(db, cookieHeaders(login.cookie), state, 1001);
  assert.ok(consumed.verifier);
  assert.equal(await consumeOauthState(db, cookieHeaders(login.cookie), state, 1002), null);
  const expired = await beginGoogleLogin(db, settings, '/', 1000);
  assert.equal(await consumeOauthState(db, cookieHeaders(expired.cookie), new URL(expired.url).searchParams.get('state'), 1601), null);
});

test('Google verifies signed identity server-side and keeps provider credentials out of the session', async () => {
  const calls = [];
  const idToken = await signedIdentity();
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id_token: idToken, access_token: 'discarded-provider-token' });
  };
  const result = await googleUserForCode(settings, 'test-code', randomToken(), nonce, fetcher, keyResolver);
  assert.deepEqual(result, user);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(calls[0].options.body.get('client_secret'), environment.GOOGLE_CLIENT_SECRET);
  assert.equal(calls[0].options.body.get('grant_type'), 'authorization_code');
  assert.equal(calls[0].options.body.get('redirect_uri'), settings.callbackUrl);
  assert.equal(JSON.stringify(result).includes('discarded-provider-token'), false);
});

test('wrong account, unverified email, wrong nonce, issuer, audience and expired ID tokens are denied', async () => {
  const invalidClaims = [
    { email: 'someone-else@gmail.com' }, { email_verified: false }, { email_verified: 'true' },
    { nonce: randomToken() }, { iss: 'https://attacker.example' }, { aud: 'another-client' },
    { azp: 'another-client' }, { sub: '' }, { exp: Math.floor(Date.now() / 1000) - 60 },
  ];
  for (const claims of invalidClaims) {
    const idToken = await signedIdentity(claims);
    await assert.rejects(googleUserForCode(settings, 'test-code', randomToken(), nonce, async () => Response.json({ id_token: idToken }), keyResolver), error => error.reason === 'denied');
  }
  const otherKeys = await generateKeyPair('RS256');
  const forgedToken = await signedIdentity({}, otherKeys.privateKey);
  await assert.rejects(googleUserForCode(settings, 'test-code', randomToken(), nonce, async () => Response.json({ id_token: forgedToken }), keyResolver), error => error.reason === 'denied');
  await assert.rejects(googleUserForCode(settings, 'test-code', randomToken(), nonce, async () => Response.json({ error: 'invalid_grant' }), keyResolver), error => error.reason === 'denied');
});

test('sessions store hashes, expire and are revoked on logout', async t => {
  const db = database(); t.after(() => db.sqlite.close());
  const cookie = await createSession(db, user, 1000);
  const headers = cookieHeaders(cookie);
  const raw = readAuthCookie(headers, SESSION_COOKIE);
  const row = db.sqlite.prepare('SELECT * FROM auth_sessions').get();
  assert.notEqual(row.session_hash, raw);
  assert.equal(row.session_hash, await tokenHash(raw));
  assert.deepEqual(await sessionUser(db, headers, settings, 1001), user);
  assert.equal(await sessionUser(db, headers, settings, 1000 + SESSION_SECONDS), null);
  assert.equal(await sessionUser(db, headers, { ...settings, allowedEmail: 'someone-else@gmail.com' }, 1001), null);
  // An old provider's session is never accepted as a Google session.
  db.sqlite.prepare('UPDATE auth_sessions SET user_id = ?').run('github:80477282');
  assert.equal(await sessionUser(db, headers, settings, 1001), null);
  await revokeSession(db, headers);
  assert.equal(await sessionUser(db, headers, settings, 1002), null);
});

test('forged, duplicate and development cookies are not production sessions', async t => {
  const db = database(); t.after(() => db.sqlite.close());
  const forged = new Headers({ cookie: '__sites_local_auth=1', host: 'localhost:5173', 'oai-authenticated-user-id': 'local_seedy', 'oai-authenticated-user-email': 'seedy@sites.test' });
  assert.equal(await sessionUser(db, forged, settings), null);
  assert.equal(localPreviewUser(forged).userId, 'local_seedy');
  forged.set('host', 'notes.example.com');
  assert.equal(localPreviewUser(forged), null);
  const token = randomToken();
  assert.equal(readAuthCookie(new Headers({ cookie: `${SESSION_COOKIE}=${token}; ${SESSION_COOKIE}=${token}` }), SESSION_COOKIE), null);
  assert.equal(await sessionUser(db, cookieHeaders(`${SESSION_COOKIE}=${randomToken()}`), settings), null);
});
