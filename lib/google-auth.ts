import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type AppUser = { userId: string; username: string; email: string; displayName: string; fullName: string | null };
export type GoogleEnvironment = { APP_ORIGIN?: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; GOOGLE_ALLOWED_EMAIL?: string };
export type GoogleSettings = { origin: string; clientId: string; clientSecret: string; allowedEmail: string; callbackUrl: string };
export type GooglePublicSettings = Omit<GoogleSettings, 'clientSecret'>;
export const SESSION_COOKIE = '__Host-upsc_google_session';
export const OAUTH_COOKIE = '__Host-upsc_google_oauth';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const OAUTH_SECONDS = 10 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function googlePublicSettings(env: GoogleEnvironment): GooglePublicSettings | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const allowedEmail = env.GOOGLE_ALLOWED_EMAIL?.trim().toLowerCase() ?? '';
  if (!/^[A-Za-z0-9_-]{6,200}\.apps\.googleusercontent\.com$/.test(clientId) || allowedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedEmail)) return null;
  try {
    const url = new URL(env.APP_ORIGIN ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return null;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    return { origin: url.origin, clientId, allowedEmail, callbackUrl: `${url.origin}/auth/google/callback` };
  } catch { return null; }
}

export function googleSettings(env: GoogleEnvironment): GoogleSettings | null {
  const settings = googlePublicSettings(env);
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
  return settings && clientSecret.length >= 20 && clientSecret.length <= 200 && !/\s/.test(clientSecret) ? { ...settings, clientSecret } : null;
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function tokenHash(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function codeChallenge(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function readAuthCookie(headers: Pick<Headers, 'get'>, name: string) {
  const values = (headers.get('cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`)).map(part => part.slice(name.length + 1));
  return values.length === 1 && tokenPattern.test(values[0]) ? values[0] : null;
}

export function authCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function localPreviewUser(headers: Pick<Headers, 'get'>): AppUser | null {
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(headers.get('host') ?? '') ||
    headers.get('oai-authenticated-user-id') !== 'local_seedy' || headers.get('oai-authenticated-user-email') !== 'seedy@sites.test') return null;
  return { userId: 'local_seedy', username: 'local-preview', email: 'seedy@sites.test', displayName: 'Local preview', fullName: 'Local preview' };
}

export async function beginGoogleLogin(db: D1Database, settings: GoogleSettings, returnTo: string, now = Math.floor(Date.now() / 1000)) {
  const state = randomToken();
  const verifier = randomToken();
  const nonce = randomToken();
  await db.batch([
    db.prepare('DELETE FROM auth_google_oauth_states WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now),
    db.prepare('INSERT INTO auth_google_oauth_states (state_hash, verifier, nonce, return_to, expires_at) VALUES (?, ?, ?, ?, ?)').bind(await tokenHash(state), verifier, nonce, returnTo, now + OAUTH_SECONDS),
  ]);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', settings.clientId);
  url.searchParams.set('redirect_uri', settings.callbackUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', await codeChallenge(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('prompt', 'select_account');
  return { url: url.href, cookie: authCookie(OAUTH_COOKIE, state, OAUTH_SECONDS) };
}

export async function consumeOauthState(db: D1Database, headers: Pick<Headers, 'get'>, state: string | null, now = Math.floor(Date.now() / 1000)) {
  const browserState = readAuthCookie(headers, OAUTH_COOKIE);
  if (!state || !tokenPattern.test(state) || browserState !== state) return null;
  // DELETE RETURNING makes the state single-use even for simultaneous callbacks.
  return db.prepare('DELETE FROM auth_google_oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING verifier, nonce, return_to')
    .bind(await tokenHash(state), now).first<{ verifier: string; nonce: string; return_to: string }>();
}

export class GoogleLoginError extends Error {
  reason: 'denied' | 'unavailable';
  constructor(reason: 'denied' | 'unavailable') { super('Google sign-in could not be completed.'); this.reason = reason; }
}

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 10000 });

export async function googleUserForCode(settings: GoogleSettings, code: string, verifier: string, nonce: string, fetcher: typeof fetch = fetch, keys: JWTVerifyGetKey = googleKeys): Promise<AppUser> {
  if (!code || code.length > 4096 || !tokenPattern.test(verifier) || !tokenPattern.test(nonce)) throw new GoogleLoginError('denied');
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: settings.clientId, client_secret: settings.clientSecret, code, code_verifier: verifier, redirect_uri: settings.callbackUrl, grant_type: 'authorization_code' }),
  });
  if (!response.ok) throw new GoogleLoginError('unavailable');
  const result = await response.json() as { id_token?: unknown; error?: unknown };
  if (result.error || typeof result.id_token !== 'string' || !result.id_token || result.id_token.length > 16384) throw new GoogleLoginError('denied');
  try {
    const { payload } = await jwtVerify(result.id_token, keys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: settings.clientId,
      algorithms: ['RS256'], requiredClaims: ['sub', 'email', 'email_verified', 'nonce', 'iat', 'exp'],
      maxTokenAge: '10m', clockTolerance: 5,
    });
    if (payload.nonce !== nonce || (payload.azp !== undefined && payload.azp !== settings.clientId) ||
      typeof payload.sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(payload.sub) ||
      payload.email_verified !== true || typeof payload.email !== 'string' ||
      payload.email.toLowerCase() !== settings.allowedEmail) throw new GoogleLoginError('denied');
    const email = payload.email.toLowerCase();
    const fullName = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim().slice(0, 150) : null;
    // Identity is the verified Google subject, never a browser-supplied email.
    // Provider ID/access tokens are not retained in D1 or the application cookie.
    return { userId: `google:${payload.sub}`, username: email, email, displayName: fullName ?? email, fullName };
  } catch (error) {
    if (error instanceof GoogleLoginError) throw error;
    throw new GoogleLoginError('denied');
  }
}

export async function createSession(db: D1Database, user: AppUser, now = Math.floor(Date.now() / 1000)) {
  const token = randomToken();
  await db.prepare('INSERT INTO auth_sessions (session_hash, user_id, username, email, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await tokenHash(token), user.userId, user.username, user.email, user.displayName, now + SESSION_SECONDS).run();
  return authCookie(SESSION_COOKIE, token, SESSION_SECONDS);
}

export async function sessionUser(db: D1Database, headers: Pick<Headers, 'get'>, settings: GoogleSettings, now = Math.floor(Date.now() / 1000)): Promise<AppUser | null> {
  const token = readAuthCookie(headers, SESSION_COOKIE);
  if (!token) return null;
  const row = await db.prepare('SELECT user_id, username, email, display_name FROM auth_sessions WHERE session_hash = ? AND expires_at > ?')
    .bind(await tokenHash(token), now).first<{ user_id: string; username: string; email: string; display_name: string }>();
  if (!row || !/^google:[A-Za-z0-9_-]{1,255}$/.test(row.user_id) || row.email.toLowerCase() !== settings.allowedEmail) return null;
  return { userId: row.user_id, username: row.username, email: row.email, displayName: row.display_name, fullName: row.display_name === row.email ? null : row.display_name };
}

export async function revokeSession(db: D1Database, headers: Pick<Headers, 'get'>) {
  const token = readAuthCookie(headers, SESSION_COOKIE);
  if (token) await db.prepare('DELETE FROM auth_sessions WHERE session_hash = ?').bind(await tokenHash(token)).run();
}
