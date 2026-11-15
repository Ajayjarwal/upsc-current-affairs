import { env } from 'cloudflare:workers';
import { getCurrentUser } from '../../auth';
import { googleSettings, beginGoogleLogin } from '../../../lib/google-auth';
import { safeLoginReturnPath, localSignInPath, authNavigationAllowed } from '../../auth-paths';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!authNavigationAllowed(request)) return new Response('Request origin did not match.', { status: 403 });
  const url = new URL(request.url);
  const returnTo = safeLoginReturnPath(url.searchParams.get('return_to'));
  const noCache = { 'Cache-Control': 'private, no-store' };
  if (import.meta.env.DEV) return new Response(null, { status: 302, headers: { ...noCache, Location: localSignInPath(returnTo) } });
  const settings = googleSettings(env);
  if (!settings || !env.DB) return new Response('Sign-in is not available yet. Please try again later.', { status: 503, headers: noCache });
  if (url.origin !== settings.origin) return new Response('Sign in from the main website address.', { status: 400, headers: noCache });
  try {
    const user = await getCurrentUser();
    if (user) return new Response(null, { status: 302, headers: { ...noCache, Location: returnTo } });
    const login = await beginGoogleLogin(env.DB, settings, returnTo);
    return new Response(null, { status: 302, headers: { ...noCache, Location: login.url, 'Set-Cookie': login.cookie } });
  } catch {
    return new Response('Sign-in is temporarily unavailable. Please try again.', { status: 503, headers: noCache });
  }
}
