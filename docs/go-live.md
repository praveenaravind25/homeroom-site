# Go live: homeroomdisplay.co

Deploy is already wired. Cloudflare Workers Builds runs `npx wrangler deploy` on every push to `main`, and `wrangler.jsonc` publishes `./public` as static assets (no build step). This page covers what's left: the owner's dashboard steps, the hidden ⇄ public switch, and how QE checks it.

**Status (2026-11-01):** domain set up by the owner, and the switch was flipped to **public** in PR #8. `site.config.json` says `"public": true`.

## 1. Owner steps (Cloudflare dashboard, about 20 min, in click order)

Agents and CI can't reach the dashboard or the DNS zone. Tick these off here, or in the issue.

- [ ] **Zone:** `homeroomdisplay.co` is on the Cloudflare account, and its nameservers point at Cloudflare (*Websites* shows it as **Active**).
- [ ] **Custom domain:** *Workers & Pages → homeroom-site → Settings → Domains & Routes → Add → Custom domain →* `homeroomdisplay.co`. Cloudflare creates the DNS record and the certificate.
- [ ] **www → apex (301):**
  1. *DNS → Records → Add:* `AAAA`, name `www`, content `100::`, **Proxied**. This record only exists so the redirect can fire.
  2. *Rules → Redirect Rules → Create from template → "Redirect from WWW to root"*: status **301**, preserve the query string.
- [ ] **Mockups behind Access** (same session as the mockup-preview setup):
  1. *Zero Trust → Access → Applications → Add → Self-hosted.*
  2. Add **both** hostnames: `mockups.homeroomdisplay.co` **and** `homeroomdisplay.co/mockups/*`. The Worker deploys all of `public/`, so the gallery is also reachable under the apex path, and protecting only the subdomain would leave that path open.
  3. Policy: **Allow**, *Include → Emails →* the owner's address only. Session: 24h is fine.
  4. The landing page and `/log/` stay outside the app, so they remain public.
- [ ] **PR previews for QE:** *homeroom-site → Settings → Build → Branch control →* turn on **builds for non-production branches**, and in *Domains & Routes* turn on **Preview URLs**. Every PR then gets a `*.workers.dev` preview link in its checks.

## 2. The switch: hidden ⇄ public

`npm run check:site` (it runs on every PR) enforces whichever mode `site.config.json` names, so the site can't change mode by accident. A missing file means hidden.

| | `"public": false` (hidden) | `"public": true` (live) |
|---|---|---|
| Pages (outside `/mockups/`) | every page has `<meta name="robots" content="noindex, nofollow">` | indexable |
| `robots.txt` | `User-agent: *` + `Disallow: /` | still `Disallow: /mockups/` |
| `404.html` | noindex | noindex |
| `/mockups/` | pipeline-owned; never hand-edit. `robots.txt` covers it | same; Access is the real lock |

**Going public is one PR that contains all of this**, and the check fails if any piece is missing:

- [x] `site.config.json` → `"public": true`
- [x] Remove the `noindex` meta from `public/index.html` and `public/log/index.html` (not from `404.html`)
- [x] `public/robots.txt` → `User-agent: *` / `Disallow: /mockups/`
- [ ] Add `Sitemap: https://homeroomdisplay.co/sitemap.xml` to `robots.txt`, and add `public/sitemap.xml` listing `/` and `/log/`
- [ ] OG tags: each page has `og:title`, `og:description`, `og:url` (the canonical) and `og:image` (an absolute URL, 1200×630). Paste the URL into a link-preview checker before sharing it.

The two unticked items weren't part of PR #8. They're harmless to add now, as their own small PR.

**Going back to hidden** is the reverse: `"public": false`, put the noindex meta back on every page, `robots.txt` → `Disallow: /`. The check lists exactly which files still need it.

## 3. QE: verify production

Run this after the owner steps, and record the output in the PR or issue comment.

```sh
curl -sI https://homeroomdisplay.co/            | head -1                 # HTTP/2 200
curl -s  https://homeroomdisplay.co/ | grep -i 'name="robots"'           # empty when public; noindex when hidden
curl -s  https://homeroomdisplay.co/robots.txt                           # matches public/robots.txt
curl -sI https://www.homeroomdisplay.co/        | grep -iE '^(HTTP|location)'  # 301 → https://homeroomdisplay.co/
curl -sI https://mockups.homeroomdisplay.co/    | grep -iE '^(HTTP|location)'  # 302 → *.cloudflareaccess.com
curl -sI https://homeroomdisplay.co/mockups/    | grep -iE '^(HTTP|location)'  # 302 → *.cloudflareaccess.com
curl -sI https://homeroomdisplay.co/no-such-page | head -1                # 404 (the site's 404 page)
npm test && npm run check:site                                            # both pass
```
