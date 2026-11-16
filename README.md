# Current Affairs — UPSC Desk

A private UPSC current news notebook using React, Vinext, Cloudflare Workers and D1.

For independent hosting from GitHub, follow [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md).

## Features

- Subject navigation with 11 subjects; each article can belong to multiple subjects, with tags and GS paper labels
- Search across headlines, summaries, content and tags
- Combined subject, tag, month, year, GS paper and revision filters
- Rich text editing: headings, bold, italic, underline, colours, highlights, lists, links, tables and images
- Image upload (PNG/JPG/WebP, up to 10 MB), clipboard paste and image URLs; embedded uploads are resized/compressed and included in JSON exports
- Account option at the bottom of the sidebar, with signed-in identity and sign-out link
- News date kept separate from creation/edit timestamps; derived month/year labels
- Source name and URL, bookmarks, and Unread / Read / Revised states
- JSON batch import with validation, article previews and duplicate-ID skipping
- Full JSON export, downloadable template and a copyable ChatGPT preparation prompt
- Online D1 storage scoped to the verified Google account
- Optimistic edit conflict detection, server-side validation, same-origin write checks, and sanitised article rendering
- Responsive collection and article views
- Persistent dark/light theme toggle in the sidebar
- Add news and Import JSON in the sidebar; collection summary at the bottom of the page

## Development and deployment

The root `wrangler.jsonc` is the configuration for independent Cloudflare hosting.
It contains the existing Cloudflare account and real `upsc-current-affairs-db` D1
binding. Set the Google client ID, site origin and allowed email with
`npm run cloudflare:configure` before enabling sign-in. Store the Google client
secret with `npm run cloudflare:secret`, never in source. `npm run cloudflare:check` reports missing configuration.

Production signs in with Google using OAuth state, PKCE and an OpenID Connect
nonce. Signed ID tokens are checked against Google keys, issuer, audience, expiry
and the permitted verified email. Only that Google account can open the private
desk. Sessions are stored as hashes in D1; provider tokens are not retained.
Local `npm run dev` keeps the existing localhost-only development account and
local notes database; it never connects to production D1.

```bash
npm run dev
npm test
npx tsc --noEmit
npm run build
```

`npm run deploy` checks configuration, builds, applies pending D1 migrations and
deploys. Workers Builds uses `npm run build` followed by `npm run deploy:built`.
See the deployment guide for Google OAuth and GitHub automatic deployment setup.

The `.openai/hosting.json` file preserves the original Site identity; it is not
the configuration used for independent Cloudflare deployment.

## Import format

Use `{ "schema": "upsc-desk/1", "articles": [...] }`.
The Import JSON dialog provides the exact schema and an example template.
Each article contains `id`, `title`, `subjects`, `tags`, `newsDate`, `gsPaper`,
`summary`, `contentHtml`, `sourceName`, `sourceUrl`, `status`, and `bookmarked`.

An imported ID already in the current visitor's collection is skipped without
overwriting the saved note. Imports accept up to 100 articles and 3 MB of JSON.
Use Edit note to change existing notes. ChatGPT preparation is a JSON workflow;
this version does not include direct AI calls or an agent write integration.

`subjects` is a non-empty array, such as `["Economy", "Environment & Ecology"]`.
Older files with a single `subject` string remain compatible.

## Article images

In Add news / Edit note, use the image icon in the Notes toolbar. Upload an image
or insert an http/https image URL, optionally with a description/caption. Images
can also be pasted from the clipboard into Notes. Uploaded images are resized to
at most 1600 pixels on the longest side and compressed to WebP where supported.
They are embedded inside `contentHtml`, so JSON exports include uploaded images;
external URLs remain links to their original host. Individual embedded images
are capped at 400,000 characters and article HTML at 1,500,000 characters, with
an additional UTF-8 row-size check before saving. Large articles should use
image URLs or split content across notes. JSON import remains limited to 3 MB.
