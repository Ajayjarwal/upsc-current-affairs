# Deploy Current Affairs with Google sign-in

The site runs on Cloudflare Workers with the existing `upsc-current-affairs-db`
D1 database. GitHub hosts the source code; website sign-in uses Google only.
Cloudflare Zero Trust is not required.

Live site: https://upsc-current-affairs.ajayjarwal.workers.dev
Private source: https://github.com/Ajayjarwal/upsc-current-affairs

## 1. Create a Google OAuth web client

Open https://console.cloud.google.com/auth/overview and select or create a project
for this site. Configure Google Auth Platform branding, then choose External for
a personal Google account. Use `Current Affairs — UPSC Desk` as the app name and
your own email as the support/developer contact. Do not activate billing or a trial.

In Audience, keep Testing for initial setup and add `ajayjarwal75@gmail.com` as a
test user. In Data access, use only `openid`, email and profile. In Clients, create
an OAuth client with application type **Web application**.

| Field | Value |
| --- | --- |
| Name | `Current Affairs Web` |
| Authorized JavaScript origin | `https://upsc-current-affairs.ajayjarwal.workers.dev` |
| Authorized redirect URI | `https://upsc-current-affairs.ajayjarwal.workers.dev/auth/google/callback` |

Use the exact redirect URI, without wildcard matching. This is a server-side
redirect flow, so JavaScript origin is optional; it is provided above for clarity.
The app uses only basic identity scopes, no Gmail or Google Drive permissions.
Google may reject sign-in inside embedded browsers; use a normal browser tab for
Google account sign-in if that happens.

## 2. Configure public values and the private secret

`wrangler.jsonc` already contains the Worker, account and D1 binding. The allowed
Google email is `ajayjarwal75@gmail.com`. Set the public client ID:

```bash
npm run cloudflare:configure -- --origin https://upsc-current-affairs.ajayjarwal.workers.dev --client-id YOUR_GOOGLE_CLIENT_ID --email ajayjarwal75@gmail.com
npm run cloudflare:check
```

Generate and save the Google client secret yourself. In Cloudflare, open
Workers & Pages > `upsc-current-affairs` > Settings > Runtime variables and secrets.
Add `GOOGLE_CLIENT_SECRET`, check **Secret**, paste its value directly, and deploy.
Do not paste the secret into chat, source, command arguments or `wrangler.jsonc`.
Alternatively run `npm run cloudflare:secret` and use its hidden interactive prompt.

Remove the obsolete `GITHUB_CLIENT_SECRET` from the Worker. Old GitHub sessions
cannot sign in: the callback route is removed, new session cookies use distinct
names, and sessions must have a Google subject and the permitted verified email.
The previously applied `0001_github_auth.sql` is kept as immutable migration
history; it does not enable GitHub login. `0002_google_auth.sql` adds Google state
and nonce storage without changing article records.

## 3. Validate and deploy

Use Node 22.13+ (Node 22 is selected by `.nvmrc`).

```bash
npm run install:ci
npm test
npx tsc --noEmit
npm run deploy
```

`npm run deploy` checks the public config, builds, applies pending migrations and
deploys. For an initial locked deployment before Google credentials exist, use
`npm run deploy:bootstrap`. Missing credentials keep Google sign-in disabled and
reject notes API access. Local development identities never work in production.

Cloudflare retains secrets across source deployments. The production config must
contain the Google client ID, allowed email and actual site origin; the secret
exists only in Cloudflare. If Wrangler authentication expires, run
`npx wrangler login` in your normal terminal and complete Cloudflare sign-in.

## 4. Connect GitHub for automatic deployments

The source is published to `Ajayjarwal/upsc-current-affairs` (private), including
`package-lock.json`. The existing `.gitignore` excludes local environment files,
credentials, database state, dependencies and generated builds.

In Cloudflare, open Workers & Pages > `upsc-current-affairs` > Settings > Builds >
Connect. Choose GitHub and the matching repository. Allow Cloudflare access only
to this repository when configuring its GitHub integration.

| Setting | Value |
| --- | --- |
| Worker name | `upsc-current-affairs` |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npm run deploy:built` |
| Build variable | `NODE_VERSION=22` |
| Build variable | `SHARP_IGNORE_GLOBAL_LIBVIPS=1` |

The deploy command checks public configuration, applies pending D1 migrations and
deploys `dist/server/wrangler.json` with the generated static assets. The build's
deployment token needs Worker deployment and D1 edit permissions in this account.
Do not create a Cloudflare Pages project for this app.

Use local previews until separate databases and OAuth callback settings have
been configured for any non-production branches you want to deploy.

## 5. Verify and import notes

Open the live site in a normal browser and choose Continue with Google. Use
`ajayjarwal75@gmail.com`. Other accounts and unverified emails are denied.
Export notes from the original localhost desk, then import that JSON while signed
in on the hosted desk. Notes are stored under the verified Google `sub` identity;
existing local notes are preserved and are not automatically uploaded.

Verify that edits survive refresh, and that sign-out blocks access to notes.
Sessions expire after seven days and are revoked in D1 on logout. Cookies are
Secure, HttpOnly, SameSite=Lax and use the `__Host-` prefix. OAuth state is bound to
the browser, expires after ten minutes and is consumed once. PKCE and nonce are
checked; ID token signatures, issuer, audience, expiry and verified owner email
are checked server-side. Google ID/access tokens are not retained.

`npm run dev` keeps the localhost development account and local notes. It does
not contact production D1 or require Google credentials.

## References

- https://developers.google.com/identity/openid-connect/openid-connect
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/d1/reference/migrations/

## Connecting the original local folder to Git

The assistant environment could not create `.git` in the original folder, so
the initial source was published through a separate checkout. Before running Git
commands from the original folder, initialize its own repository from a normal
terminal (only if that folder does not already contain `.git`):

```bash
cd "/Users/jaynezx/Desktop/CSE/websites/upsc-current-affairs"
git init -b main
git remote add origin https://github.com/Ajayjarwal/upsc-current-affairs.git
git fetch origin main
git reset --mixed origin/main
git branch --set-upstream-to=origin/main main
git status
```

The mixed reset sets the initial Git index and history; it does not replace the
working files. Review `git status` before committing your next update.
