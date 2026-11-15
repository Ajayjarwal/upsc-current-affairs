import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { googlePublicSettings } from '../lib/google-auth.ts';

export const configPath = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url));
export function readCloudflareConfig() {
  const { config, error } = ts.parseConfigFileTextToJson(configPath, readFileSync(configPath, 'utf8'));
  if (error) throw new Error('wrangler.jsonc contains invalid JSON.');
  return config;
}

export function deploymentProblems(config, bootstrap = false) {
  const problems = [];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(config.name ?? '')) problems.push('Set a valid Worker name.');
  if (!/^[a-f0-9]{32}$/i.test(config.account_id ?? '')) problems.push('Set your Cloudflare account_id.');
  const db = config.d1_databases?.find(item => item.binding === 'DB');
  if (!db || !/^[a-f0-9-]{36}$/i.test(db.database_id ?? '') || db.database_id === '00000000-0000-4000-8000-000000000000') problems.push('Set the real D1 database ID for binding DB.');
  if (!bootstrap && !googlePublicSettings(config.vars ?? {})) problems.push('Set APP_ORIGIN, GOOGLE_CLIENT_ID and GOOGLE_ALLOWED_EMAIL for Google sign-in.');
  if (Object.hasOwn(config.vars ?? {}, 'GOOGLE_CLIENT_SECRET')) problems.push('Remove GOOGLE_CLIENT_SECRET from wrangler.jsonc. Store it as a Cloudflare secret instead.');
  return problems;
}
