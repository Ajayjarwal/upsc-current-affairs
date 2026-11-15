import { readCloudflareConfig, deploymentProblems } from './cloudflare-config.mjs';

const config = readCloudflareConfig();
const problems = deploymentProblems(config, process.argv.includes('--bootstrap'));
if (problems.length) {
  console.error('Cloudflare deployment setup is incomplete:\n' + problems.map(problem => `- ${problem}`).join('\n'));
  console.error('Run npm run cloudflare:configure -- --origin https://YOUR_SITE --client-id YOUR_GOOGLE_CLIENT_ID --email YOUR_GOOGLE_EMAIL');
  process.exitCode = 1;
} else {
  console.log(`Cloudflare configuration passes local checks: ${config.name}, D1 binding DB${process.argv.includes('--bootstrap') ? ', bootstrap mode (sign-in disabled until configured)' : ', Google sign-in configured'}.`);
}
