/**
 * Screenshots from the product's sample-data build (issue #3).
 *
 *   npm run shots                     fresh clone of praveenaravind25/homeroom @ main
 *   npm run shots -- --ref <sha|branch>
 *
 * Writes public/shots/<name>.png (each exactly 1263×841) and public/shots/manifest.json
 * ({ "sha": … }, nothing else).
 *
 *   npm run shots -- --only recipes   a build-log image (LOG_SCREENS): public/assets/log/<name>.png,
 *                                     its product SHA recorded in public/assets/log/manifest.json.
 *                                     Never part of a default run: a log entry's image is pinned to
 *                                     the merge it describes, so it doesn't follow main.
 *
 * Privacy, in order of defence:
 *   - the product is a fresh clone in .cache/ (gitignored), so there is no local config in it;
 *   - the server gets its own config, written here from config/homeroom.example.json with every
 *     source pinned to "fake", via HOMEROOM_CONFIG, so the loader never looks for *.local.json;
 *   - the server runs with HOME pointed at an empty temp dir, so no `~/` path can reach ~/.homeroom;
 *   - before anything is served, the product's own loadConfig() must report only fake sources and
 *     only the sample household (Avery, Jordan, Sam, Riley), or the run aborts;
 *   - the running server's own startup line must say every source is fake, or the run aborts;
 *   - PNGs are stripped to their image chunks, then put through the site privacy check.
 *
 * Determinism: the server's clock and RNG are pinned (scripts/shots/clock.mjs), the page's clock
 * starts at the same instant, each shot gets a fresh server and page, the photo drift is pinned to
 * its start pose, and Playwright's screenshot settles every other animation.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadAllowlist, loadDenyList, scanFile, format } from './check-site.mjs';

const ROOT = join(import.meta.dirname, '..');
const REPO = 'praveenaravind25/homeroom';
const CACHE = join(ROOT, '.cache');
const PRODUCT = join(CACHE, 'homeroom');
const OUT = join(ROOT, 'public', 'shots');
const LOG_OUT = join(ROOT, 'public', 'assets', 'log');

const W = 1263;
const H = 841;
// A Thursday afternoon in the household's tz: after the Morning Bell window, dinner on the board.
const NOW = '2026-10-15T16:20:00-07:00';
const SEED = 20261015;
const PORT = 4797;
const SAMPLE_HOUSEHOLD = ['Avery', 'Jordan', 'Sam', 'Riley'];
const SOURCES = ['photos', 'calendar', 'home', 'lists', 'recipes']; // recipes: the fixture box (fixtures/recipes, CC0)

// ---------------------------------------------------------------- helpers

const log = (msg) => console.log(`shots: ${msg}`);

function die(msg) {
  console.error(`shots: ABORT, ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

// ---------------------------------------------------------------- 1. a fresh product clone

function freshClone(ref) {
  rmSync(PRODUCT, { recursive: true, force: true });
  mkdirSync(CACHE, { recursive: true });
  log(`cloning ${REPO} @ ${ref}`);
  // gh carries the token (GH_TOKEN in CI); blob-less keeps it quick and still checks out any SHA.
  run('gh', ['repo', 'clone', REPO, PRODUCT, '--', '--quiet', '--filter=blob:none']);
  run('git', ['-C', PRODUCT, 'checkout', '--quiet', '--detach', ref]);
  return execFileSync('git', ['-C', PRODUCT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function build() {
  log('installing and building the app (sample-data build)');
  run('npm', ['ci', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: PRODUCT });
  run('npm', ['run', 'build', '--silent'], { cwd: PRODUCT });
  const args = ['playwright', 'install', 'chromium'];
  if (process.env.CI) args.push('--with-deps');
  run('npx', args, { cwd: PRODUCT });
}

// ---------------------------------------------------------------- 2. the config, and proof it's fake

function writeConfig(dataDir) {
  const example = JSON.parse(readFileSync(join(PRODUCT, 'config', 'homeroom.example.json'), 'utf8'));
  const cfg = {
    ...example,
    env: 'development',
    port: PORT, // host stays the example's loopback; proveFake() checks it
    dataDir,
    sources: Object.fromEntries(SOURCES.map((s) => [s, 'fake'])),
  };
  // Nothing that names a secret file or a device, even an example one.
  delete cfg.immich;
  delete cfg.fully;
  delete cfg.recipes; // an example drive path and key file; the fake box needs neither
  const path = join(CACHE, 'shots.config.json');
  if (/\.local\.json$/.test(path)) die('refusing a *.local.json config');
  writeFileSync(path, JSON.stringify(cfg, null, 2));
  return path;
}

/** Loads the config with the product's own loader, as the server will, and checks what it reports. */
function proveFake(configPath, env) {
  const loader = pathToFileURL(join(PRODUCT, 'server', 'src', 'config.ts')).href;
  const probe = `const { loadConfig } = await import(${JSON.stringify(loader)});
    const c = loadConfig(${JSON.stringify(configPath)});
    console.log(JSON.stringify({ sources: c.sources, members: c.household.members.map((m) => m.name), host: c.host, port: c.port }));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: PRODUCT, env, encoding: 'utf8' });
  const got = JSON.parse(out.trim().split('\n').pop());
  const real = Object.entries(got.sources).filter(([, v]) => v !== 'fake');
  if (real.length) die(`the loaded config has a non-fake source (${real.map(([k]) => k).join(', ')})`);
  const strangers = got.members.filter((m) => !SAMPLE_HOUSEHOLD.includes(m));
  if (strangers.length) die('the loaded config has a member outside the sample household');
  // Loopback only: the sample build is never served to the LAN.
  const loopback = got.host === 'localhost' || got.host === '::1' || got.host.split('.')[0] === '127';
  if (!loopback) die('the loaded config binds a non-loopback host');
  origin = `http://${got.host.includes(':') ? `[${got.host}]` : got.host}:${got.port}`;
  log(`config verified: every source fake; household ${got.members.join(', ')}`);
  return got;
}

/** Where the sample build is served, from the loaded config (set by proveFake). */
let origin = '';

// ---------------------------------------------------------------- 3. serve

async function serve(env) {
  const child = spawn(process.execPath, ['--import', pathToFileURL(join(import.meta.dirname, 'shots', 'clock.mjs')).href, 'server/src/main.ts'], {
    cwd: PRODUCT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let banner = '';
  child.stdout.on('data', (d) => (banner += d));
  child.stderr.on('data', (d) => process.stderr.write(d));
  const exited = new Promise((_, reject) => child.on('exit', (code) => reject(new Error(`server exited (${code})`))));

  const deadline = Date.now() + 30_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error('server did not come up in 30 s');
    const up = await Promise.race([
      fetch(`${origin}/api/v1/health`).then((r) => r.ok, () => false),
      exited,
    ]);
    if (up) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  exited.catch(() => {}); // from here on, an exit is ours (stop()), not a failed start
  // The server's own word: "[homeroom] development on http://… (photos=fake calendar=fake …)".
  const reported = /\(([^)]*)\)/.exec(banner)?.[1] ?? '';
  const pairs = Object.fromEntries(reported.split(/\s+/).filter(Boolean).map((p) => p.split('=')));
  // Every pinned source must be listed, and nothing it lists (a source added later) may be real.
  if (!SOURCES.every((s) => pairs[s] === 'fake') || Object.values(pairs).some((v) => v !== 'fake')) {
    child.kill();
    die('the running server did not report every source as fake');
  }
  return child;
}

/** SIGTERM (the server closes its store on it), then wait, so nothing is still writing when we clean up. */
function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const force = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.once('exit', () => {
      clearTimeout(force);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

// ---------------------------------------------------------------- 4. capture

const FAST_LADDER = '&modes.glanceSustainMs=1000&modes.glanceGraceMs=60000&presence.quietMs=60000&presence.faceHoldMs=0';

/** Each screen: how to get there from a freshly opened hub. Mirrors the product's e2e helpers. */
const SCREENS = {
  ambient: async () => {},
  glance: async (page) => {
    await page.evaluate(() => window.__homeroom.face(true));
    await page.locator('.hub[data-mode="glance"]').waitFor({ timeout: 15_000 });
    await page.locator('[data-overlay][data-tier="glance"]').waitFor();
    await page.locator('.overlay [data-weather]').waitFor({ state: 'attached' });
  },
  'rail-today': toRail,
  week: async (page) => nav(page, 'week'),
  home: async (page) => nav(page, 'home'),
  who: async (page) => {
    await toRail(page);
    await page.locator('[data-who]').click();
    await page.locator('[data-rail][data-screen-id="who"]').waitFor();
  },
  chores: async (page) => nav(page, 'chores'),
  'add-sheet': async (page) => {
    await toRail(page);
    await page.locator('[data-rail] [data-add]').click();
    await page.locator('[data-sheet][role="dialog"]').waitFor();
  },
};

/**
 * Build-log images (content/log/README.md): same capture and checks, written to public/assets/log/.
 * The recipe is the sample box's corn bowl, reached as the product's e2e does (e2e/recipes.spec.ts),
 * then stepped to 6 servings (2× the recipe's 3) so the shot shows the rescale (⅔ cup, 4–6 cloves).
 */
const LOG_SCREENS = {
  recipes: async (page) => {
    const bowl = 'r-5a3c1e0b9d';
    await nav(page, 'meals');
    await page.locator('[data-recipe-box-entry]').click();
    await page.locator(`[data-shelf="new"] [data-recipe-card="${bowl}"]`).click();
    await page.locator(`[data-screen="recipe"][data-recipe="${bowl}"]`).waitFor();
    await page.locator('[data-review-line]').waitFor();
    await page.locator('[data-watch]').waitFor();
    // The wall opens at its own serving count, not the recipe's: step until it reads 6 (2× the recipe's 3).
    const servings = page.locator('[data-servings]');
    for (let i = 0; i < 12 && (await servings.textContent())?.trim() !== '6'; i++) await page.locator('[data-servings-up]').click();
    await page.locator('[data-ingredient="garlic"] [data-qty]').filter({ hasText: /^4–6 cloves$/ }).waitFor();
    // The hero comes off the (temp) drive through the media route: wait until it has pixels.
    await page.waitForFunction(() => document.querySelector('[data-hero] img')?.naturalWidth > 0);
    await page.mouse.move(0, 0); // no hover state left on the stepper
    // A stepper click can nudge the left column's scroll (it scrolls a few px rather than clip):
    // rest every scroller on the screen at the top, so the hero is whole and the shot repeats.
    await page.locator('[data-screen="recipe"]').evaluate((root) => {
      for (const el of [root, ...root.querySelectorAll('*')]) if (el.scrollTop) el.scrollTop = 0;
    });
  },
};

const outFor = (name) => (LOG_SCREENS[name] ? LOG_OUT : OUT);

async function toRail(page) {
  await page.mouse.click(600, 400);
  await page.locator('.hub[data-mode="active"]').waitFor();
  await page.locator('[data-rail].shown').waitFor();
  await page.locator('[data-screen="today"]').waitFor();
}

async function nav(page, id) {
  await toRail(page);
  await page.locator(`[data-nav="${id}"]`).click();
  await page.locator(`[data-screen="${id}"]`).waitFor();
}

/**
 * The Ken Burns drift is a long WAAPI animation on real compositor time (the page clock
 * can't hold it), and a tap snapshots its pose into the rail's Photos thumbnail. Rest every
 * long animation at its start pose before touching anything, so that pose is the same each run.
 */
async function pinDrift(page) {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      const t = a.effect?.getComputedTiming();
      if (!t || (Number.isFinite(t.activeDuration) && t.activeDuration <= 3000)) continue;
      a.pause();
      a.currentTime = t.delay ?? 0;
    }
  });
}

/**
 * One fresh server per shot: curation remembers what it has shown, so a shared server would
 * hand later screens whatever photo the earlier pages' timing left next. `fresh(fn)` runs fn
 * against a just-started server on an empty data dir.
 */
async function capture(chromium, names, fresh) {
  const browser = await chromium.launch();
  const shots = [];
  const missing = [];
  try {
    for (const name of names) await fresh(async () => {
      const context = await browser.newContext({
        viewport: { width: W, height: H },
        deviceScaleFactor: 1, // the spec's pixel size is the CSS size: 1263×841
        hasTouch: true,
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
        colorScheme: 'dark',
        reducedMotion: 'no-preference',
      });
      const page = await context.newPage();
      await page.clock.install({ time: new Date(NOW) });
      await page.addInitScript((seed) => {
        let s = seed >>> 0;
        Math.random = () => {
          s = (s + 0x6d2b79f5) >>> 0;
          let t = s;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }, SEED);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.goto(`${origin}/?test&interval=3600&poll=3600${FAST_LADDER}`);
        // As the product's openHub(): a photo has settled and the clock and credit are up.
        await page.locator('.screen.on .cell:not([hidden]) img[src^="blob:"]').first().waitFor();
        await page.locator('[data-clock]').waitFor();
        await page.locator('[data-credit]').waitFor({ state: 'attached' });
        await pinDrift(page);
        await (SCREENS[name] ?? LOG_SCREENS[name])(page);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1800); // the settle curve; the screenshot then pins any stragglers
        await pinDrift(page); // the photo in the rail's thumbnail keeps drifting under the Rail
        const file = join(outFor(name), `${name}.png`);
        const png = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
        writeFileSync(file, stripPng(png));
        if (errors.length) log(`${name}: page logged ${errors.length} error(s): ${errors[0].slice(0, 120)}`);
        shots.push(name);
        log(`${name}.png`);
      } catch (e) {
        // A screen the sample build can't reach yet: ship the rest and say which (spec: don't stall).
        missing.push(name);
        log(`${name}: NOT CAPTURED (${(e instanceof Error ? e.message : String(e)).split('\n')[0]})`);
      } finally {
        await context.close();
      }
    });
  } finally {
    await browser.close();
  }
  return { shots, missing };
}

// ---------------------------------------------------------------- 5. clean + verify the output

/** Keeps only the chunks that draw the image: no text, EXIF, time or colour-profile chunks. */
export function stripPng(buf) {
  const KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
  const parts = [buf.subarray(0, 8)];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (KEEP.has(type)) parts.push(buf.subarray(off, off + 12 + len));
    off += 12 + len;
  }
  return Buffer.concat(parts);
}

export function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function verify(files) {
  const { entities, vocabulary } = loadAllowlist();
  const ctx = { allow: entities, terms: loadDenyList(vocabulary).terms };
  const problems = [];
  for (const abs of files) {
    const name = relative(ROOT, abs);
    if (name.endsWith('.png')) {
      const { width, height } = pngSize(readFileSync(abs));
      if (width !== W || height !== H) problems.push(`${name} is ${width}×${height}, not ${W}×${H}`);
    }
    for (const f of scanFile(abs, name, ctx)) problems.push(format(f));
  }
  if (problems.length) die(`output failed verification:\n  ${problems.join('\n  ')}`);
}

// ---------------------------------------------------------------- main

async function main() {
  const ref = arg('ref', 'main');
  const only = arg('only', null)?.split(',');
  const names = only ?? Object.keys(SCREENS);
  const unknown = names.filter((n) => !SCREENS[n] && !LOG_SCREENS[n]);
  if (unknown.length) die(`unknown screen(s): ${unknown.join(', ')}`);

  const sha = process.argv.includes('--no-clone') ? reuse() : freshClone(ref);
  if (!process.argv.includes('--no-build')) build();

  const home = mkdtempSync(join(tmpdir(), 'homeroom-shots-home-'));
  const dataDir = mkdtempSync(join(tmpdir(), 'homeroom-shots-data-'));
  const configPath = writeConfig(dataDir);
  // HOME is an empty temp dir for everything the product runs: `~/.homeroom` can't resolve to the real one.
  const env = { ...process.env, HOME: home, HOMEROOM_CONFIG: configPath, SHOTS_NOW: NOW, SHOTS_SEED: String(SEED) };
  proveFake(configPath, env);

  const fresh = async (fn) => {
    rmSync(dataDir, { recursive: true, force: true });
    mkdirSync(dataDir);
    const server = await serve(env);
    try {
      await fn();
    } finally {
      await stop(server);
    }
  };
  let result;
  try {
    const { chromium } = createRequire(join(PRODUCT, 'package.json'))('@playwright/test');
    for (const n of names) mkdirSync(outFor(n), { recursive: true });
    result = await capture(chromium, names, fresh);
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(dataDir, { recursive: true, force: true });
  }

  const files = result.shots.map((n) => join(outFor(n), `${n}.png`));
  // public/shots/ is one product commit: its manifest moves only when one of its shots does.
  if (result.shots.some((n) => SCREENS[n])) {
    writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify({ sha }, null, 2)}\n`);
    files.push(join(OUT, 'manifest.json'));
  }
  // Log images are pinned one by one, so their manifest is a name → SHA map, merged.
  const logged = result.shots.filter((n) => LOG_SCREENS[n]);
  if (logged.length) {
    const path = join(LOG_OUT, 'manifest.json');
    const prev = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    const next = { ...prev, ...Object.fromEntries(logged.map((n) => [n, sha])) };
    const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
    writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
    files.push(path);
  }
  verify(files);
  log(`done: ${result.shots.length} shot(s) from ${sha.slice(0, 12)}`);
  if (result.missing.length) {
    console.error(`shots: missing ${result.missing.join(', ')} (not reachable in the sample build at this commit)`);
    process.exit(1);
  }
}

/** --no-clone: reuse .cache/homeroom as is (local iteration only; the pipeline always clones fresh). */
function reuse() {
  if (!existsSync(join(PRODUCT, '.git'))) die('--no-clone needs an existing .cache/homeroom');
  if (existsSync(join(PRODUCT, 'config', 'homeroom.local.json'))) die('.cache/homeroom has a homeroom.local.json; refusing');
  return execFileSync('git', ['-C', PRODUCT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  main().catch((e) => {
    console.error(`shots: failed, ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
