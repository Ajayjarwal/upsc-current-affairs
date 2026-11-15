import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { googlePublicSettings } from '../lib/google-auth.ts';
import { configPath, readCloudflareConfig } from './cloudflare-config.mjs';

const { values } = parseArgs({ options: { origin: { type: 'string' }, 'client-id': { type: 'string' }, 'email': { type: 'string' } } });
const config = readCloudflareConfig();
const settings = googlePublicSettings({ APP_ORIGIN: values.origin, GOOGLE_CLIENT_ID: values['client-id'], GOOGLE_ALLOWED_EMAIL: values['email'] ?? config.vars?.GOOGLE_ALLOWED_EMAIL });
if (!settings) throw new Error('Provide --origin https://YOUR_SITE --client-id YOUR_GOOGLE_CLIENT_ID --email YOUR_GOOGLE_EMAIL.');
config.vars = { APP_ORIGIN: settings.origin, GOOGLE_CLIENT_ID: settings.clientId, GOOGLE_ALLOWED_EMAIL: settings.allowedEmail };
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`Google sign-in configuration saved. Callback URL: ${settings.callbackUrl}. Store the client secret with npm run cloudflare:secret.`);
