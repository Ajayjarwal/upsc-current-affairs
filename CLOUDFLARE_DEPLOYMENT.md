# Deploy Current Affairs with GitHub sign-in

The application uses Cloudflare Workers for hosting, the existing
`upsc-current-affairs-db` D1 database, and GitHub OAuth for sign-in. Cloudflare
Zero Trust is not used and does not need to be activated.

`wrangler.jsonc` contains the Worker name, Cloudflare account, real D1 binding,
site origin, public OAuth client ID and permitted GitHub user ID. The current
permitted user ID is the connected owner's GitHub account (`80477282`).

## 1. Build and create the initial Worker

Use Node 22.13+ in the Node 22 line (`.nvmrc` selects Node 22).

```bash
npm run install:ci
npm test
npx tsc --noEmit
npm run deploy:bootstrap
```

The bootstrap command builds, applies pending D1 migrations and deploys the
Worker. It is for first-time setup, so it allows missing OAuth configuration.
Until the GitHub client ID and secret are supplied, production sign-in stays
disabled and every notes API request is rejected. The development identity
cannot access the hosted website.

Copy the workers.dev URL printed by deployment. This is the site's origin.
The callback URL will be that origin followed by `/auth/github/callback`.

## 2. Register a GitHub OAuth app

Open https://github.com/settings/applications/new in the owner account.

| Field | Value |
| --- | --- |
| Application name | `Current Affairs — UPSC Desk` |
| Homepage URL | The deployed HTTPS workers.dev origin |
| Description | `Private UPSC current affairs notebook` |
| Authorization callback URL | `https://YOUR_SITE/auth/github/callback` |

Use the exact callback URL without wildcard matching. Device Flow is not needed.
Expiring provider access tokens can remain enabled: this app uses the provider
token once to fetch identity, then discards it and uses its own D1 session.

Register the app and generate its client secret yourself. Do not paste the secret
into chat, GitHub source files, an issue, or `wrangler.jsonc`.

The login request uses PKCE and an unguessable, single-use, browser-bound state.
It asks for identity only, with no repository or private-email scopes. The server
checks the returned numeric GitHub ID against the configured owner ID before
creating a session.

## 3. Save the public configuration and private secret

Copy the OAuth app's public client ID and run:

```bash
npm run cloudflare:configure -- --origin https://YOUR_SITE --client-id YOUR_CLIENT_ID --user-id 80477282
npm run cloudflare:check
```

The command writes only public identifiers to `wrangler.jsonc`.

Store the client secret directly in Cloudflare, either through its dashboard
(Worker > Settings > Variables and Secrets > Add > Secret, name
`GITHUB_CLIENT_SECRET`) or through this interactive command:

```bash
npm run cloudflare:secret
```

Paste the secret into that command's hidden prompt, not into the command line.
Then deploy:

```bash
npm run deploy
```

Cloudflare retains the secret across future deployments. It is accessed only by
the server at runtime. Public configuration checks do not verify the secret's
presence; the deployed login page stays unavailable if the secret is missing.

## 4. Connect GitHub for automatic deployments

Push this project to its own private GitHub repository, including
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

## 5. Verify and import your notes

Open the live website and choose Continue with GitHub. Check that the app requests
only your identity. Signing in with a different GitHub account should be denied.
Export all notes from the original local desk, then import that JSON while signed
in to the hosted desk. This associates the notes with your verified GitHub ID.

The initial articles migration has already been applied. The GitHub auth
migration creates `auth_sessions` and `auth_oauth_states`; migrations never upload
your local notes or change their ownership. New migrations are applied with:

```bash
npm run db:migrate
```

Check that edits survive a refresh, and that signing out prevents access to the
notes. A session lasts seven days, is stored only as a SHA-256 hash in D1, and is
revoked server-side on logout. Session and OAuth cookies are Secure, HttpOnly,
SameSite=Lax and use the __Host- prefix. Expired records are cleaned up on login.

Code changes deploy when pushed to `main`. Notes are runtime D1 data, so adding
or editing notes does not require a GitHub push.

## Local development

`npm run dev` retains the original local database and development account. It
does not contact the production database or require GitHub credentials.

## References

- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/d1/reference/migrations/
