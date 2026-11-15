const reservedAuthPaths = new Set(['/signin-with-chatgpt', '/signout-with-chatgpt', '/callback', '/auth/sign-in', '/auth/sign-out', '/auth/github/callback']);

export function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (url.origin !== 'https://app.local' || reservedAuthPaths.has(url.pathname.replace(/\/+$/, ''))) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

export function safeLoginReturnPath(value: unknown): string {
  const path = safeRelativeReturnPath(typeof value === 'string' ? value : '/');
  return new URL(path, 'https://app.local').pathname.replace(/\/$/, '') === '/login' ? '/' : path;
}

export function loginPagePath(returnTo = '/'): string {
  return `/login?return_to=${encodeURIComponent(safeLoginReturnPath(returnTo))}`;
}

export const signInPath = (returnTo = '/') => `/auth/sign-in?return_to=${encodeURIComponent(safeLoginReturnPath(returnTo))}`;
export const signOutPath = (returnTo = '/login') => `/auth/sign-out?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
export const localSignInPath = (returnTo = '/') => `/signin-with-chatgpt?return_to=${encodeURIComponent(safeLoginReturnPath(returnTo))}`;
export const localSignOutPath = (returnTo = '/login') => `/signout-with-chatgpt?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;

export function authNavigationAllowed(request: Request) {
  const origin = request.headers.get('origin');
  return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
}
