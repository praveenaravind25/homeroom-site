/**
 * Self-test for scripts/check-site.mjs (issue #3, AC11): one seeded bad input per
 * rule proves it fires, the masks hold, and the real tree passes. Issue #4 adds the
 * indexing guard: hidden vs public, each tested on a throwaway site.
 *
 * Every bad string here is obviously fake and assembled at runtime (joined from
 * parts), so this file passes the check it tests.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
import {
  configTerms, disallowedForAll, format, hasNoindex, indexFindings, loadAllowlist, loadDenyList, loadSiteConfig, scanFile, scanText, scanTree,
} from './check-site.mjs';

const ROOT = join(import.meta.dirname, '..');
const CLI = join(import.meta.dirname, 'check-site.mjs');

// Seeded leaks. Joined so no literal in this file matches a rule.
const EMAIL = ['sam.fixture', 'example-selftest.zz'].join('@');
const IPS = [[10, 1, 2, 3], [172, 20, 0, 9], [192, 168, 40, 7], [127, 0, 0, 1]].map((o) => o.join('.'));
const ENTITY = ['light', 'selftest_porch_lamp'].join('.');
const SECRET = ['Zebulon', 'Fakename'].join(' ');
const SECRET_HOST = ['selftest-tablet', 'invalid'].join('.');

const { entities, vocabulary } = loadAllowlist();
const ctx = (terms = null) => ({ allow: entities, terms });
const rules = (text, terms) => scanText(text, ctx(terms)).map((f) => f.rule);

const tmp = mkdtempSync(join(tmpdir(), 'check-site-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** A 1×1 PNG carrying one tEXt chunk. */
function pngWithText(keyword, text) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from(`${keyword}\0${text}`, 'latin1')),
    chunk('IDAT', deflateSync(Buffer.from([0, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A stub JPEG with one COM segment (enough for the segment walker). */
function jpegWithComment(text) {
  const body = Buffer.from(text, 'latin1');
  const len = Buffer.alloc(2);
  len.writeUInt16BE(body.length + 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xfe]), len, body, Buffer.from([0xff, 0xd9])]);
}

describe('each rule fires on one seeded bad input', () => {
  test('email address, with its line and column', () => {
    const [f, ...rest] = scanText(`# Contact\n\nWrite to ${EMAIL} any time.`, ctx());
    assert.equal(rest.length, 0);
    assert.deepEqual([f.rule, f.line, f.col], ['email', 3, 10]);
  });

  test('private and loopback IPv4: 10.x, 172.16-31.x, 192.168.x, 127.x', () => {
    for (const ip of IPS) assert.deepEqual(rules(`host ${ip}:8123`), ['ip'], ip);
  });

  test('public IPs, out-of-range ranges and version strings are not private IPs', () => {
    const near = ['8.8.8.8', '172.32.0.1', '172.15.9.9', '192.169.1.1', '10.300.1.1', 'v1.10.0.0.1'];
    for (const s of near) assert.deepEqual(rules(`at ${s}`), [], s);
  });

  test('Home Assistant entity id not in the allowlist', () => {
    assert.deepEqual(rules(`toggles ${ENTITY} at dusk`), ['entity']);
    assert.deepEqual(rules(`a fixture: ${[...entities][0]}`), [], 'allowlisted fixture ids pass');
  });

  test('ordinary code and file names are not entity ids', () => {
    const code = 'el.addEventListener("click", (event) => event.target.focus()); image.width; text.length; "light.svg"; script.src; document.body';
    assert.deepEqual(rules(code), []);
  });

  test('a value from the real config, and its quick picks / tuning / vocabulary are skipped', () => {
    const config = {
      household: { members: [{ id: 'member-a', name: SECRET }] },
      fully: { host: SECRET_HOST },
      hub: { quickAdd: { picks: { chore: ['Empty the dishwasher'] } }, ambient: { rhythm: ['spread'] } },
      curation: { rules: { nonPhotoTerms: ['document'] } },
      ha: { familyhub: { lists: [{ title: 'Groceries', kind: 'groceries' }] } },
      sources: { photos: 'immich' },
      env: 'production',
    };
    const terms = configTerms(config, vocabulary);
    assert.deepEqual(terms.sort(), [SECRET, 'member-a', SECRET_HOST].sort());
    assert.deepEqual(rules(`<p>Built for ${SECRET}.</p>`, terms), ['config']);
    assert.deepEqual(rules('<p>Empty the dishwasher, buy Groceries, open the document.</p>', terms), []);
  });

  test('text hidden in PNG metadata (tEXt) and JPEG comments', () => {
    writeFileSync(join(tmp, 'shot.png'), pngWithText('Author', EMAIL));
    writeFileSync(join(tmp, 'photo.jpg'), jpegWithComment(`camera at ${IPS[2]}`));
    const png = scanFile(join(tmp, 'shot.png'), 'shot.png', ctx());
    const jpg = scanFile(join(tmp, 'photo.jpg'), 'photo.jpg', ctx());
    assert.deepEqual(png.map((f) => [f.rule, f.where]), [['email', 'png tEXt']]);
    assert.deepEqual(jpg.map((f) => [f.rule, f.where]), [['ip', 'jpeg COM']]);
  });

  test('SVG text and file paths are scanned too', () => {
    writeFileSync(join(tmp, 'logo.svg'), `<svg xmlns="http://www.w3.org/2000/svg"><text>${ENTITY}</text></svg>`);
    assert.deepEqual(scanFile(join(tmp, 'logo.svg'), 'logo.svg', ctx()).map((f) => f.rule), ['entity']);
    const named = `${EMAIL}.txt`;
    writeFileSync(join(tmp, named), 'nothing inside');
    assert.deepEqual(scanFile(join(tmp, named), named, ctx()).map((f) => [f.rule, f.where]), [['email', 'path']]);
  });
});

describe('masking: failure output never carries the matched value', () => {
  test('format() masks every rule', () => {
    const text = [EMAIL, ...IPS, ENTITY, SECRET].join('\n');
    const lines = scanText(text, ctx([SECRET])).map((f) => format({ ...f, file: 'x.html', where: null }));
    assert.equal(lines.length, 7);
    for (const raw of [EMAIL, ...IPS, ENTITY, SECRET, 'selftest_porch_lamp', 'Zebulon', 'Fakename']) {
      assert.ok(!lines.some((l) => l.includes(raw)), `leaked ${raw}`);
    }
  });

  test('the CLI exits 1 with file:line + rule name, and no raw values, on a seeded tree', () => {
    const tree = join(tmp, 'tree');
    mkdirSync(join(tree, 'public'), { recursive: true });
    writeFileSync(join(tree, 'public', 'index.html'), `<p>${SECRET}</p>\n<p>${EMAIL}</p>\n<p>${IPS[0]}</p>\n<p>${ENTITY}</p>\n`);
    const local = join(tmp, 'homeroom.local.json');
    writeFileSync(local, JSON.stringify({ household: { members: [{ name: SECRET }] } }));
    const run = spawnSync(process.execPath, [CLI, '--root', tree], { encoding: 'utf8', env: { ...process.env, HOMEROOM_LOCAL_CONFIG: local } });
    assert.equal(run.status, 1);
    const out = run.stdout + run.stderr;
    for (const [line, rule] of [[1, 'config'], [2, 'email'], [3, 'ip'], [4, 'entity']]) {
      assert.match(out, new RegExp(`public/index\\.html:${line}:\\d+  ${rule}:`));
    }
    for (const raw of [SECRET, 'Zebulon', EMAIL, IPS[0], ENTITY]) assert.ok(!out.includes(raw), `leaked ${raw}`);
  });

  test('a broken local config fails without quoting it', () => {
    const bad = join(tmp, 'broken.local.json');
    writeFileSync(bad, `{ "name": "${SECRET}", oops }`);
    assert.throws(() => loadDenyList(vocabulary, bad), (e) => !e.message.includes(SECRET));
  });
});

describe('no local config (CI)', () => {
  test('pattern rules still run, and the CLI says the deny-list is off', () => {
    const tree = join(tmp, 'clean');
    mkdirSync(join(tree, 'public'), { recursive: true });
    // No site.config.json, so hidden by default: the page and robots.txt say so.
    writeFileSync(join(tree, 'public', 'index.html'), '<meta name="robots" content="noindex, nofollow"><h1>Homeroom</h1><p>Avery, Jordan, Sam and Riley.</p>');
    writeFileSync(join(tree, 'public', 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    const run = spawnSync(process.execPath, [CLI, '--root', tree], { encoding: 'utf8', env: { ...process.env, HOMEROOM_LOCAL_CONFIG: join(tmp, 'absent.json') } });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /no local config at .*pattern rules only/);
    assert.match(run.stdout, /check-site: clean/);
    assert.equal(loadDenyList(vocabulary, join(tmp, 'absent.json')).terms, null);
  });
});

describe('indexing guard (issue #4): one flag decides', () => {
  const NOINDEX = '<meta name="robots" content="noindex, nofollow">';
  /** A throwaway site from { 'public/x.html': '...', 'site.config.json': '...' }. */
  function site(name, files) {
    const root = join(tmp, name);
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    return root;
  }
  const failing = (root, cfg) => indexFindings(root, cfg).map((f) => f.file.split(sep).join('/')).sort();

  test('hidden: every page needs noindex and robots.txt needs Disallow: /', () => {
    const root = site('hidden', {
      'public/index.html': '<title>Home</title>',
      'public/log/index.html': '<head><meta content="noindex" name="robots"></head>',
      'public/robots.txt': 'User-agent: *\nDisallow: /mockups/\n',
      'public/mockups/issue-9/index.html': '<p>pipeline-owned, covered by robots.txt</p>',
    });
    assert.deepEqual(failing(root, { public: false }), ['public/index.html', 'public/robots.txt']);
  });

  test('hidden: a fully hidden tree passes, and a missing robots.txt fails', () => {
    const root = site('hidden-ok', { 'public/index.html': NOINDEX, 'public/robots.txt': '# staging\nUser-agent: *\nDisallow: /\n' });
    assert.deepEqual(failing(root, { public: false }), []);
    const bare = site('hidden-bare', { 'public/index.html': NOINDEX });
    assert.deepEqual(failing(bare, { public: false }), ['public/robots.txt']);
  });

  test('public: pages may be indexable, but /mockups/ and the 404 stay hidden', () => {
    const files = { 'public/index.html': '<title>Home</title>', 'public/mockups/index.html': NOINDEX };
    const leaky = site('public-leaky', { ...files, 'public/404.html': '<title>Lost</title>', 'public/robots.txt': 'User-agent: *\nDisallow:\n' });
    assert.deepEqual(failing(leaky, { public: true }), ['public/404.html', 'public/robots.txt']);
    const ok = site('public-ok', { ...files, 'public/404.html': NOINDEX, 'public/robots.txt': 'User-agent: *\nDisallow: /mockups/\n' });
    assert.deepEqual(failing(ok, { public: true }), []);
  });

  test('robots.txt: only rules under User-agent: * count', () => {
    assert.deepEqual([...disallowedForAll('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /mockups/ # gallery\n')], ['/mockups/']);
    assert.deepEqual([...disallowedForAll('User-agent: Bingbot\nUser-agent: *\nDisallow: /\n')], ['/']);
    assert.deepEqual([...disallowedForAll('User-agent: *\nAllow: /\n')], []);
  });

  test('noindex is found in any attribute order, and only on a robots meta', () => {
    assert.ok(hasNoindex(`<META CONTENT='noindex' NAME='robots'>`));
    assert.ok(!hasNoindex('<meta name="googlebot-news" content="noindex">'));
    assert.ok(!hasNoindex('<meta name="description" content="noindex is a word">'));
  });

  test('site.config.json: missing means hidden; anything but a boolean "public" is an error', () => {
    assert.deepEqual(loadSiteConfig(join(tmp, 'absent.config.json')), { public: false });
    const bad = join(tmp, 'bad.config.json');
    writeFileSync(bad, '{ "public": "yes" }');
    assert.throws(() => loadSiteConfig(bad), /needs "public": true or false/);
    writeFileSync(bad, '{ public: true');
    assert.throws(() => loadSiteConfig(bad), /isn't valid JSON/);
  });

  test('the CLI fails with the file and the fix when the flag and the tree disagree', () => {
    const root = site('cli-mismatch', { 'site.config.json': '{ "public": false }', 'public/index.html': '<h1>Homeroom</h1>', 'public/robots.txt': 'User-agent: *\nDisallow: /\n' });
    const run = spawnSync(process.execPath, [CLI, '--root', root], { encoding: 'utf8', env: { ...process.env, HOMEROOM_LOCAL_CONFIG: join(tmp, 'absent.json') } });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /says hidden/);
    assert.match(run.stderr, /public\/index\.html {2}index: .*noindex/);
    assert.match(run.stderr, /flip "public" in site\.config\.json/);
  });
});

describe('the real tree', () => {
  test('passes, with the local deny-list too when this machine has one', () => {
    const findings = scanTree(ROOT, ctx(loadDenyList(vocabulary).terms));
    assert.deepEqual(findings.map(format), []);
  });

  test('matches its own site.config.json flag', () => {
    assert.deepEqual(indexFindings(ROOT, loadSiteConfig()).map(format), []);
  });
});
