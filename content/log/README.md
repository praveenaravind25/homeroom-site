# Build log entries

One file per entry. The file name is the entry's slug and its anchor on `/log/` (`the-rail.md` → `/log/#the-rail`), so use lowercase words and hyphens.

```md
---
title: The photo steps aside, and the Rail opens
date: 2026-11-01T12:37:22Z
refs: [homeroom #10, homeroom #18]
screenshot: /assets/log/the-rail.png
alt: The Today screen from the sample household's wall: the agenda, dinner, chores and home.
---
Two to four plain sentences. What changed for the household, and why it matters.
One "how" sentence if the pipeline story is interesting.
```

| Key | Required | Rule |
|---|---|---|
| `title` | yes | ≤ 60 characters, plain, no emoji or `!` |
| `date` | yes | ISO merge date: `2026-11-01`, or the exact merge time `2026-11-01T12:37:22Z` (orders same-day entries). For a chapter, the last merge in it. |
| `refs` | yes | Plain text, never links (the product repo is private): `[homeroom #44]` or one `- homeroom #44` per line |
| `screenshot` | no | A file in `public/assets/log/`, exactly 1263×841, from the sample-data build |
| `render` | no | Instead of a screenshot: a live render the site draws itself (`today`, `week`, `home`, `wall:<photo>`). A stand-in until screenshots exist. |
| `alt` | with a screenshot or render | What a visitor would see |
| `before` | no | A before/after entry: a second 1263×841 file in `public/assets/log/`, shown beside `screenshot` (the after), both under the text. The landing teaser shows the after alone. |
| `before_alt` | with `before` | What a visitor would see in the before |
| `labels` | no, with `before` | Two short captions, before then after: `[Corner ovals, Option D]` |

No screenshot and no render is fine: the entry drops its image column.

**Body:** 2–4 sentences, one paragraph, plain text (no Markdown or HTML). Voice: plain, warm, specific, a little dry. No hype words, no exclamation marks, no emoji.

**Privacy:** text comes only from the sample household (Avery, Jordan, Sam, Riley). Photos are the product's fixture photos or the owner-approved set in `source-photos/owner/` (`npm run shots -- --photo owner-03`). Never name or identify the people in an owner photo, in alt text or anywhere else: describe the scene. No real names, calendar contents, device or entity names, addresses or IPs.

## Build and check

```sh
node scripts/build-log.mjs           # validate, then write the entries into public/
node scripts/build-log.mjs --check   # validate, and fail if public/ is out of date (CI runs this)
```

The renderer writes between the `<!-- build-log:… -->` markers in `public/log/index.html` (every entry, newest first) and `public/index.html` (the three newest). Commit the rendered pages with the entry: the site deploys `public/` as it is, with no build step.
