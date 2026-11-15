import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from 'cloudflare:workers';
import { githubSettings, localPreviewUser, sessionUser } from '../lib/github-auth';
import { loginPagePath } from './auth-paths';

export async function getCurrentUser() {
  const requestHeaders = await headers();
  if (import.meta.env.DEV) return localPreviewUser(requestHeaders);
  const settings = githubSettings(env);
  if (!settings || !env.DB) return null;
  return sessionUser(env.DB, requestHeaders, settings);
}

export async function requireUser(returnTo = '/') {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(loginPagePath(returnTo));
}

export function authenticationReady() {
  return import.meta.env.DEV || (githubSettings(env) !== null && !!env.DB);
}
