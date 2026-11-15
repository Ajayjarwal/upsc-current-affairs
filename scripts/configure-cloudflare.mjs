import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { githubPublicSettings } from '../lib/github-auth.ts';
import { configPath, readCloudflareConfig } from './cloudflare-config.mjs';

const { values } = parseArgs({ options: { origin: { type: 'string' }, 'client-id': { type: 'string' }, 'user-id': { type: 'string' } } });
const config = readCloudflareConfig();
const settings = githubPublicSettings({ APP_ORIGIN: values.origin, GITHUB_CLIENT_ID: values['client-id'], GITHUB_ALLOWED_USER_ID: values['user-id'] ?? config.vars?.GITHUB_ALLOWED_USER_ID });
if (!settings) throw new Error('Provide --origin https://YOUR_SITE --client-id YOUR_GITHUB_CLIENT_ID --user-id YOUR_GITHUB_USER_ID.');
config.vars = { APP_ORIGIN: settings.origin, GITHUB_CLIENT_ID: settings.clientId, GITHUB_ALLOWED_USER_ID: settings.allowedUserId };
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`GitHub sign-in configuration saved. Callback URL: ${settings.callbackUrl}. Store the client secret with npm run cloudflare:secret.`);
