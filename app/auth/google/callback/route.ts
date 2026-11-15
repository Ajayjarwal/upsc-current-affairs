import { env } from 'cloudflare:workers';
import { googleSettings, consumeOauthState, googleUserForCode, createSession, GoogleLoginError, authCookie, OAUTH_COOKIE } from '../../../../lib/google-auth';
import { safeLoginReturnPath } from '../../../auth-paths';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const settings = googleSettings(env);
  const headers = new Headers({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
  headers.append('Set-Cookie', authCookie(OAUTH_COOKIE, '', 0));
  const failure = (reason: string) => {
    headers.set('Location', `/login?error=${reason}`);
    return new Response(null, { status: 302, headers });
  };
  if (import.meta.env.DEV || !settings || !env.DB || url.origin !== settings.origin) return failure('unavailable');
  let stage: 'state' | 'identity' | 'session' = 'state';
  try {
    const state = await consumeOauthState(env.DB, request.headers, url.searchParams.get('state'));
    if (!state) return failure('expired');
    if (url.searchParams.has('error')) return failure('cancelled');
    const code = url.searchParams.get('code');
    if (!code) return failure('expired');
    stage = 'identity';
    const user = await googleUserForCode(settings, code, state.verifier, state.nonce);
    stage = 'session';
    headers.append('Set-Cookie', await createSession(env.DB, user));
    headers.set('Location', safeLoginReturnPath(state.return_to));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    // Static categories only: never log tokens, cookies, email, SQL or URLs.
    console.error('google_sign_in_failed', {
      stage,
      reason: error instanceof GoogleLoginError ? error.reason : 'unavailable',
      diagnostic: error instanceof GoogleLoginError ? error.diagnostic : 'internal',
    });
    return failure(error instanceof GoogleLoginError ? error.reason : 'unavailable');
  }
}
