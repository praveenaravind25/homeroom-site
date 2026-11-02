# Homeroom Site

The public showcase for **Homeroom**, a wall tablet that's a photo frame first and knows the household. It has two parts: a **landing page** (what it is, who it's for, why it's being built, how it's built) and a **build log**.

- The product lives in a separate private repo (`praveenaravind25/homeroom`). This repo never contains its code, config or household data.
- Built and maintained by the agentic studio pipeline (the "Homeroom Site" board). Product merges hand off build-log candidates here; the PM triages which are page-worthy.
- Project rules for agents: `docs/brief.md`.

## Privacy check (`npm run check:site`)

Runs on every PR (`.github/workflows/check-site.yml`) and must pass. It scans every tracked file (and untracked, non-ignored files, so a local run sees new files before CI does) and everything in `public/`, including PNG/JPEG metadata and file names, and fails with `file:line rule masked-value` on:

- an email address;
- a private or loopback IP (10.x, 172.16–31.x, 192.168.x, 127.x);
- a Home Assistant entity id that isn't a sample-data fixture (`scripts/check-site.allowlist.json`);
- any value from the real household config, when `~/.homeroom/homeroom.local.json` exists on the machine (point `HOMEROOM_LOCAL_CONFIG` elsewhere if needed). CI has no such file, so it runs the pattern rules only and says so.

Matched values are always masked in the output. `npm test` is the self-test: one seeded fake input per rule, then the real tree.

The same run checks search indexing against `"public"` in `site.config.json`. Hidden means noindex on every page and `robots.txt` `Disallow: /`. Public means `/mockups/` stays disallowed and the 404 keeps noindex. A missing file counts as hidden. Going live checklist: `docs/go-live.md`.

If a generic word from the real config trips the check (a list name, a room), add it to `vocabulary` in the allowlist. Never add a person, place, address, device or id.

## Screenshots (`npm run shots`)

```sh
npm run shots                    # product @ main
npm run shots -- --ref <sha>     # a specific product commit
npm run shots -- --only week,who # a subset
```

The script makes a fresh clone of `praveenaravind25/homeroom` in `.cache/` (gitignored), installs it, builds it and serves it on a config written from the product's `config/homeroom.example.json`, with every source pinned to `fake`. It aborts unless the product's own config loader and the running server both report only fake sources and only the sample household (Avery, Jordan, Sam, Riley). The server runs with `HOME` set to an empty temp dir, so `~/.homeroom` is unreachable.

It writes eight 1263×841 PNGs to `public/shots/` (`ambient`, `glance`, `rail-today`, `week`, `home`, `who`, `chores`, `add-sheet`) plus `manifest.json` (the product commit SHA only). The shots are stripped of metadata and put through the privacy check before the script exits.

Build-log images are separate screens, captured only by name and never in a default run, because a log entry's image stays pinned to the merge it describes. `npm run shots -- --ref <merge-sha> --only shopping` writes `public/assets/log/shopping.png` (the sample box's next week as one Shopping list, from the product's generated CC0 fixtures in `fixtures/recipes/`) and records its product SHA in `public/assets/log/manifest.json`. These images get the same fake-only config, empty `HOME`, PNG strip and privacy check as the others. To add one, add an entry to `LOG_SCREENS` in `scripts/shots.mjs`.

Runs are repeatable: the clock is pinned (Thursday 15 October 2026, 4:20 PM, household time), the RNG is seeded, each shot gets a fresh server, and animations are settled. Re-running on the same product commit gives byte-identical files, except for the rail's 72 px Photos thumbnail, which can differ by about 1–3/255 per channel (GPU resampling, not visible).

Needs Node ≥ 22.18, `gh` signed in with read access to the product repo, and about a minute. Playwright and Chromium come from the product's own dev dependencies, so this repo stays dependency-free.

### After a product merge (pipeline)

Until the trigger is wired (follow-up), run it by hand or from the engine after a product PR merges:

```sh
git checkout -b shots/<product-sha> main
npm run shots -- --ref <product-sha>
npm run check:site
git add public/shots && git commit -m "Shots: product <short-sha>" && git push -u origin HEAD
gh pr create --base main --fill
```

The PR diff shows which screens changed. To run it in GitHub Actions, the job needs a token that can read the private product repo (the default `GITHUB_TOKEN` can't). Store it as a repo secret, expose it as `GH_TOKEN`, and add `npx playwright install-deps chromium` or run with `CI=1`, which makes the script install the browser's system dependencies.
