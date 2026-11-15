export type AppUser = { userId: string; username: string; email: string; displayName: string; fullName: string | null };
export type GitHubEnvironment = { APP_ORIGIN?: string; GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string; GITHUB_ALLOWED_USER_ID?: string };
export type GitHubSettings = { origin: string; clientId: string; clientSecret: string; allowedUserId: string; callbackUrl: string };
export type GitHubPublicSettings = Omit<GitHubSettings, 'clientSecret'>;
export const SESSION_COOKIE = '__Host-upsc_session';
export const OAUTH_COOKIE = '__Host-upsc_oauth';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const OAUTH_SECONDS = 10 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function githubPublicSettings(env: GitHubEnvironment): GitHubPublicSettings | null {
  const clientId = env.GITHUB_CLIENT_ID?.trim() ?? '';
  const allowedUserId = env.GITHUB_ALLOWED_USER_ID?.trim() ?? '';
  if (!/^[A-Za-z0-9_.-]{6,100}$/.test(clientId) || !/^[1-9]\d{0,19}$/.test(allowedUserId)) return null;
  try {
    const url = new URL(env.APP_ORIGIN ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return null;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    return { origin: url.origin, clientId, allowedUserId, callbackUrl: `${url.origin}/auth/github/callback` };
  } catch { return null; }
}

export function githubSettings(env: GitHubEnvironment): GitHubSettings | null {
  const settings = githubPublicSettings(env);
  const clientSecret = env.GITHUB_CLIENT_SECRET?.trim() ?? '';
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

export async function beginGithubLogin(db: D1Database, settings: GitHubSettings, returnTo: string, now = Math.floor(Date.now() / 1000)) {
  const state = randomToken();
  const verifier = randomToken();
  await db.batch([
    db.prepare('DELETE FROM auth_oauth_states WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now),
    db.prepare('INSERT INTO auth_oauth_states (state_hash, verifier, return_to, expires_at) VALUES (?, ?, ?, ?)').bind(await tokenHash(state), verifier, returnTo, now + OAUTH_SECONDS),
  ]);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', settings.clientId);
  url.searchParams.set('redirect_uri', settings.callbackUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', await codeChallenge(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('scope', ''); // Identity only; no repository or private-email permissions.
  return { url: url.href, cookie: authCookie(OAUTH_COOKIE, state, OAUTH_SECONDS) };
}

export async function consumeOauthState(db: D1Database, headers: Pick<Headers, 'get'>, state: string | null, now = Math.floor(Date.now() / 1000)) {
  const browserState = readAuthCookie(headers, OAUTH_COOKIE);
  if (!state || !tokenPattern.test(state) || browserState !== state) return null;
  // DELETE RETURNING makes the state single-use even for simultaneous callbacks.
  return db.prepare('DELETE FROM auth_oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING verifier, return_to')
    .bind(await tokenHash(state), now).first<{ verifier: string; return_to: string }>();
}

export class GitHubLoginError extends Error {
  reason: 'denied' | 'unavailable';
  constructor(reason: 'denied' | 'unavailable') { super('GitHub sign-in could not be completed.'); this.reason = reason; }
}

export async function githubUserForCode(settings: GitHubSettings, code: string, verifier: string, fetcher: typeof fetch = fetch): Promise<AppUser> {
  if (!code || code.length > 512 || !tokenPattern.test(verifier)) throw new GitHubLoginError('denied');
  const response = await fetcher('https://github.com/login/oauth/access_token', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: settings.clientId, client_secret: settings.clientSecret, code, code_verifier: verifier, redirect_uri: settings.callbackUrl }),
  });
  if (!response.ok) throw new GitHubLoginError('unavailable');
  const result = await response.json() as { access_token?: unknown; token_type?: unknown; error?: unknown };
  if (result.error || typeof result.access_token !== 'string' || !result.access_token || result.access_token.length > 4096 || result.token_type !== 'bearer') throw new GitHubLoginError('denied');
  const profileResponse = await fetcher('https://api.github.com/user', {
    redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${result.access_token}`, 'User-Agent': 'UPSC-Current-Affairs' },
  });
  if (!profileResponse.ok) throw new GitHubLoginError('unavailable');
  const profile = await profileResponse.json() as { id?: unknown; login?: unknown; name?: unknown; email?: unknown };
  if (typeof profile.id !== 'number' || !Number.isSafeInteger(profile.id) || profile.id < 1 || String(profile.id) !== settings.allowedUserId ||
    typeof profile.login !== 'string' || !/^[A-Za-z0-9-]{1,39}$/.test(profile.login)) throw new GitHubLoginError('denied');
  const fullName = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim().slice(0, 150) : null;
  const email = typeof profile.email === 'string' && profile.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) ? profile.email : '';
  // Provider tokens are used once to verify identity and are never stored.
  return { userId: `github:${profile.id}`, username: profile.login, email, displayName: fullName ?? `@${profile.login}`, fullName };
}

export async function createSession(db: D1Database, user: AppUser, now = Math.floor(Date.now() / 1000)) {
  const token = randomToken();
  await db.prepare('INSERT INTO auth_sessions (session_hash, user_id, username, email, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await tokenHash(token), user.userId, user.username, user.email, user.displayName, now + SESSION_SECONDS).run();
  return authCookie(SESSION_COOKIE, token, SESSION_SECONDS);
}

export async function sessionUser(db: D1Database, headers: Pick<Headers, 'get'>, settings: GitHubSettings, now = Math.floor(Date.now() / 1000)): Promise<AppUser | null> {
  const token = readAuthCookie(headers, SESSION_COOKIE);
  if (!token) return null;
  const row = await db.prepare('SELECT user_id, username, email, display_name FROM auth_sessions WHERE session_hash = ? AND expires_at > ?')
    .bind(await tokenHash(token), now).first<{ user_id: string; username: string; email: string; display_name: string }>();
  if (!row || row.user_id !== `github:${settings.allowedUserId}`) return null;
  return { userId: row.user_id, username: row.username, email: row.email, displayName: row.display_name, fullName: row.display_name.startsWith('@') ? null : row.display_name };
}

export async function revokeSession(db: D1Database, headers: Pick<Headers, 'get'>) {
  const token = readAuthCookie(headers, SESSION_COOKIE);
  if (token) await db.prepare('DELETE FROM auth_sessions WHERE session_hash = ?').bind(await tokenHash(token)).run();
}
