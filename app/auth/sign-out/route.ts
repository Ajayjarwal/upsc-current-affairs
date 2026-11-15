import { localSignOutPath, safeLoginReturnPath, authNavigationAllowed } from '../../auth-paths';
import { env } from 'cloudflare:workers';
import { revokeSession, authCookie, SESSION_COOKIE, OAUTH_COOKIE } from '../../../lib/google-auth';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!authNavigationAllowed(request)) return new Response('Request origin did not match.', { status: 403 });
  const url = new URL(request.url);
  const returnTo = safeLoginReturnPath(url.searchParams.get('return_to'));
  if (import.meta.env.DEV) return new Response(null, { status: 302, headers: { 'Cache-Control': 'private, no-store', Location: localSignOutPath(returnTo === '/' ? '/login' : returnTo) } });
  try {
    if (env.DB) await revokeSession(env.DB, request.headers);
  } catch {
    return new Response('Sign-out is temporarily unavailable. Please try again.', { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const headers = new Headers({ 'Cache-Control': 'private, no-store', Location: '/login' });
  headers.append('Set-Cookie', authCookie(SESSION_COOKIE, '', 0));
  headers.append('Set-Cookie', authCookie(OAUTH_COOKIE, '', 0));
  return new Response(null, { status: 302, headers });
}
