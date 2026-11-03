/**
 * Hero framing check (issue #39): the landing Wall exactly covers the stage on first paint, and stays that way.
 *
 *   npm run hero-fit
 *
 * Serves public/ on a loopback port and drives Chromium from the product checkout `npm run shots` makes
 * (.cache/homeroom), so it adds no dependency to this repo. Not in CI: CI has no browser here.
 * For each viewport (390×844 and 412×915 as touch phones, 1440×900 and 1920×1080 desktop) it asserts:
 *   1. on load, no scroll: the Wall's computed transform is rectOf('cover') for the stage's current size,
 *      and the stage is the visible viewport's height;
 *   2. a scroll that stays in step 0, and back to the top: the transform is unchanged;
 *   3. the stage's box changes with no window resize (a stand-in for the URL bar or a late layout):
 *      it re-fits; then a window resize: it re-fits.
 * Plus: reduced motion fits on load, and without JS the still Wall is one viewport tall.
 * The real iOS URL bar can't be emulated; eyeball that on a phone.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const PUBLIC = join(ROOT, 'public');
const PRODUCT = join(ROOT, '.cache', 'homeroom');
const VIEWPORTS = [
  { name: '390×844 phone', width: 390, height: 844, mobile: true },
  { name: '412×915 phone', width: 412, height: 915, mobile: true },
  { name: '1440×900 desktop', width: 1440, height: 900, mobile: false },
  { name: '1920×1080 desktop', width: 1920, height: 1080, mobile: false },
];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain' };

function die(msg) {
  console.error(`hero-fit: ABORT, ${msg}`);
  process.exit(1);
}

function serve() {
  const server = createServer((req, res) => {
    let path = normalize(join(PUBLIC, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(PUBLIC + sep) && path !== PUBLIC) return res.writeHead(403).end();
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!existsSync(path)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(readFileSync(path));
  });
  return new Promise((ok) => server.listen(0, 'localhost',() => ok(server)));
}

// The Wall's transform against the cover fit for the stage as it is now (landing.js rectOf('cover')).
const measure = () => {
  const stage = document.querySelector('#pin .stage'), wall = stage.querySelector('.wall');
  const w = stage.clientWidth, h = stage.clientHeight, k = Math.max(w / 1263, h / 841);
  const t = new DOMMatrix(getComputedStyle(wall).transform);
  return { stage: [w, h], visible: innerHeight, want: { x: (w - 1263 * k) / 2, y: (h - 841 * k) / 2, k }, got: { x: t.e, y: t.f, k: t.a } };
};
const fits = (m) => Math.abs(m.got.x - m.want.x) < 0.5 && Math.abs(m.got.y - m.want.y) < 0.5 && Math.abs(m.got.k - m.want.k) < 1e-3;
const show = (m) => `stage ${m.stage.join('×')}, want k=${m.want.k.toFixed(4)} (${m.want.x.toFixed(1)},${m.want.y.toFixed(1)}), got k=${m.got.k.toFixed(4)} (${m.got.x.toFixed(1)},${m.got.y.toFixed(1)})`;
const frames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n ? requestAnimationFrame(f) : ok()); requestAnimationFrame(f); }), n);

let failed = 0;
function check(label, ok, detail) {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
  if (!ok) failed++;
}

async function main() {
  if (!existsSync(join(PRODUCT, 'package.json'))) die('no product checkout in .cache/homeroom; run `npm run shots` once, it installs Chromium there');
  const { chromium } = createRequire(join(PRODUCT, 'package.json'))('@playwright/test');
  const server = await serve();
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      console.log(`hero-fit: ${vp.name}`);
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load' });
      await frames(page);
      const first = await page.evaluate(measure);
      check('1. covers the stage on load', fits(first), show(first));
      check('1. stage is the visible height', first.stage[1] === first.visible, `${first.stage[1]} vs ${first.visible}`);

      await page.evaluate(() => scrollTo(0, 12));                                     // under the 24px step-1 threshold
      await frames(page);
      await page.evaluate(() => scrollTo(0, 0));
      await frames(page);
      const back = await page.evaluate(measure);
      check('2. same framing after a first scroll', fits(back) && back.got.k === first.got.k && back.got.y === first.got.y, show(back));

      await page.addStyleTag({ content: '.stick > .stage{height:86vh!important}' });  // the stage moves, the window doesn't
      await frames(page);
      const moved = await page.evaluate(measure);
      check('3. re-fits when the stage changes without a resize', moved.stage[1] !== first.stage[1] && fits(moved), show(moved));

      await page.setViewportSize({ width: Math.round(vp.width * 0.8), height: Math.round(vp.height * 0.9) });
      await frames(page);
      const resized = await page.evaluate(measure);
      check('3. re-fits on a window resize', fits(resized), show(resized));
      await ctx.close();
    }

    console.log('hero-fit: reduced motion, 390×844');
    let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    let page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await frames(page);
    const rm = await page.evaluate(measure);
    check('covers the stage on load', fits(rm), show(rm));
    await ctx.close();

    console.log('hero-fit: no JS, 1440×900');
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    const still = await page.evaluate(() => [document.querySelector('#pin .wall').getBoundingClientRect().height, innerHeight]);
    check('the still Wall is one viewport tall', still[0] === still[1], `${still[0]} vs ${still[1]}`);
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) die(`${failed} check(s) failed`);
  console.log('hero-fit: all checks pass');
}

main();
