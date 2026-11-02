// Tests for scripts/build-log.mjs.  Run: node --test scripts/
// Each case builds a throwaway copy of the site with its own content/log/, then runs the real CLI on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

function site(entries, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'build-log-'));
  for (const p of ['scripts/build-log.mjs', 'public/index.html', 'public/log/index.html', 'public/assets/hub.js'])
    cpSync(join(REPO, p), join(dir, p), { recursive: true });
  mkdirSync(join(dir, 'content/log'), { recursive: true });
  for (const [name, text] of Object.entries(entries)) writeFileSync(join(dir, 'content/log', name), text);
  for (const [p, buf] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), buf); }
  const run = (...args) => spawnSync(process.execPath, [join(dir, 'scripts/build-log.mjs'), ...args], { encoding: 'utf8' });
  const read = p => readFileSync(join(dir, p), 'utf8');
  return { dir, run, read, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const entry = (fm = {}, body = 'The wall learned a new trick. Avery noticed first.') => {
  const d = { title: 'A small thing that shipped', date: '2026-11-02', refs: '[homeroom #50]', ...fm };
  return '---\n' + Object.entries(d).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n---\n' + body + '\n';
};

function png(w, h) {
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc((w + 1) * h))), chunk('IEND', Buffer.alloc(0))]);
}

function fails(fm, body, pattern, files) {
  const s = site({ 'x.md': entry(fm, body) }, files);
  try {
    const r = s.run('--check');
    assert.equal(r.status, 1, `expected failure, got: ${r.stdout}`);
    assert.match(r.stderr, pattern);
  } finally { s.done(); }
}

test('the committed backfill validates and public/ is up to date', () => {
  const r = spawnSync(process.execPath, [join(REPO, 'scripts/build-log.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('rejects a title over 60 characters', () => fails({ title: 'x'.repeat(61) }, undefined, /61 characters/));
test('rejects a missing date', () => fails({ date: undefined }, undefined, /missing date/));
test('rejects a non-ISO date', () => fails({ date: 'Nov 1 2026' }, undefined, /isn't ISO/));
test('rejects a one-sentence body', () => fails({}, 'Only one sentence here.', /1 sentence /));
test('rejects a five-sentence body', () => fails({}, 'One. Two. Three. Four. Five.', /5 sentences/));
test('rejects a ref that is a URL', () => fails({ refs: '[https://github.com/x/y/pull/4]' }, undefined, /looks like a link/));
test('rejects a bare-domain ref', () => fails({ refs: '[github.com/x/y#4]' }, undefined, /looks like a link/));
test('rejects an exclamation mark in prose', () => fails({}, 'It works now! Sam is pleased.', /exclamation/));
test('rejects an emoji in the title', () => fails({ title: 'Lights on 💡' }, undefined, /title has an emoji/));
test('rejects an emoji in the body', () => fails({}, 'The wall is warm ☀️ now. Riley agrees.', /body has an emoji/));
test('rejects unknown keys', () => fails({ tags: 'x' }, undefined, /unknown key "tags"/));
test('rejects a screenshot that is not 1263×841', () =>
  fails({ screenshot: '/assets/log/x.png', alt: 'The Today screen, sample household.' }, undefined, /is 1200×800/, { 'public/assets/log/x.png': png(1200, 800) }));
test('rejects a missing screenshot file', () =>
  fails({ screenshot: '/assets/log/nope.png', alt: 'The Today screen, sample household.' }, undefined, /not found/));
test('requires alt text with a screenshot', () =>
  fails({ screenshot: '/assets/log/x.png' }, undefined, /alt text is required/, { 'public/assets/log/x.png': png(1263, 841) }));
test('rejects a render the site cannot draw', () => fails({ render: 'todya', alt: 'The Today screen, sample household.' }, undefined, /render "todya"/));

test('does not split sentences on "e.g." or numbers', async () => {
  const { sentences } = await import(join(REPO, 'scripts/build-log.mjs'));
  assert.equal(sentences('It runs at 1263×841. Pick a photo, e.g. the beach. Done.').length, 3);
});

test('a correct 1263×841 screenshot renders as an img with alt, size and lazy loading', () => {
  const s = site({ 'shot.md': entry({ screenshot: '/assets/log/shot.png', alt: 'The Week screen, sample household.' }) },
                 { 'public/assets/log/shot.png': png(1263, 841) });
  try {
    assert.equal(s.run().status, 0);
    assert.match(s.read('public/log/index.html'), /<img class="shot rv" src="\/assets\/log\/shot.png" width="1263" height="841" alt="The Week screen, sample household." loading="lazy"/);
  } finally { s.done(); }
});

test('no entries: /log/ shows an empty line and the landing page drops the section', () => {
  const s = site({});
  try {
    assert.equal(s.run().status, 0);
    assert.match(s.read('public/log/index.html'), /class="log-empty/);
    assert.doesNotMatch(s.read('public/log/index.html'), /class="entries"/);
    assert.doesNotMatch(s.read('public/index.html'), /class="log3"/);
    assert.equal(s.run('--check').status, 0, 'rendering is stable');
  } finally { s.done(); }
});

test('one entry with no image: a single card, no broken image, the column collapses', () => {
  const s = site({ 'only.md': entry() });
  try {
    assert.equal(s.run().status, 0);
    const region = (html, name) => html.match(new RegExp(`<!-- build-log:${name} -->([\\s\\S]*?)<!-- /build-log:${name} -->`))[1];
    const log = region(s.read('public/log/index.html'), 'entries'), home = region(s.read('public/index.html'), 'teaser');
    assert.equal((log.match(/class="entry"/g) || []).length, 1);
    assert.match(log, /class="body solo"/);
    assert.doesNotMatch(log + home, /<img|data-mini/);
    assert.equal((home.match(/class="logc/g) || []).length, 1);
  } finally { s.done(); }
});

test('newest first; same-day entries order by exact time, then latest ref; refs stay plain text', () => {
  const s = site({
    'a.md': entry({ title: 'Older', date: '2026-10-30', refs: '[homeroom #99]' }),
    'b.md': entry({ title: 'Same day, earlier', date: '2026-11-02T08:00:00Z', refs: '[homeroom #60]' }),
    'c.md': entry({ title: 'Same day, later', date: '2026-11-02T20:00:00Z', refs: '[homeroom #51]' }),
    'd.md': entry({ title: 'Newest', date: '2026-11-03', refs: '\n  - homeroom #70\n  - homeroom #71\n  - site #2' }),
  });
  try {
    assert.equal(s.run().status, 0);
    const log = s.read('public/log/index.html');
    const order = [...log.matchAll(/<h2>([^<]+)<\/h2>/g)].map(m => m[1]);
    assert.deepEqual(order, ['Newest', 'Same day, later', 'Same day, earlier', 'Older']);
    assert.match(log, /<div class="ref">homeroom #70, #71, site #2<\/div>/);
    assert.equal((s.read('public/index.html').match(/class="logc/g) || []).length, 3, 'landing shows the three newest');
  } finally { s.done(); }
});

test('--check fails when public/ is stale', () => {
  const s = site({ 'only.md': entry() });
  try {
    const r = s.run('--check');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /out of date/);
  } finally { s.done(); }
});

test('a before/after entry: both images side by side under the text; the teaser shows the after alone', () => {
  const s = site({ 'pair.md': entry({ screenshot: '/assets/log/after.png', alt: 'The wall after, with a gradient.', before: '/assets/log/before.png', before_alt: 'The wall before, with ovals.', labels: '[Corner ovals, Option D]' }) },
                 { 'public/assets/log/after.png': png(1263, 841), 'public/assets/log/before.png': png(1263, 841) });
  try {
    assert.equal(s.run().status, 0);
    const log = s.read('public/log/index.html');
    assert.match(log, /class="body pair">\s*<div class="rv"[^>]*>\s*<h2>/, 'text first');
    assert.match(log, /<div class="cmp">[\s\S]*src="\/assets\/log\/before.png"[^>]*alt="The wall before, with ovals."[\s\S]*<span class="lab">Before<\/span><span>Corner ovals<\/span>[\s\S]*src="\/assets\/log\/after.png"[\s\S]*<span class="lab">After<\/span><span>Option D<\/span>/);
    const home = s.read('public/index.html');
    assert.match(home, /src="\/assets\/log\/after.png"/);
    assert.doesNotMatch(home, /before.png/);
    assert.equal(s.run('--check').status, 0, 'rendering is stable');
  } finally { s.done(); }
});
test('before needs a screenshot to sit beside', () =>
  fails({ before: '/assets/log/b.png', before_alt: 'The wall before the change.' }, undefined, /before needs a screenshot/, { 'public/assets/log/b.png': png(1263, 841) }));
test('before needs its own alt text', () =>
  fails({ screenshot: '/assets/log/a.png', alt: 'The wall after the change.', before: '/assets/log/b.png' }, undefined, /before_alt is required/,
        { 'public/assets/log/a.png': png(1263, 841), 'public/assets/log/b.png': png(1263, 841) }));
test('a before image must be 1263×841 too', () =>
  fails({ screenshot: '/assets/log/a.png', alt: 'The wall after the change.', before: '/assets/log/b.png', before_alt: 'The wall before the change.' }, undefined, /before \/assets\/log\/b.png is 800×600/,
        { 'public/assets/log/a.png': png(1263, 841), 'public/assets/log/b.png': png(800, 600) }));

test('escapes HTML in prose', () => {
  const s = site({ 'x.md': entry({ title: 'Tags & things' }, 'Jordan wrote a list. It says milk & eggs.') });
  try {
    assert.equal(s.run().status, 0);
    assert.match(s.read('public/log/index.html'), /Tags &amp; things[\s\S]*milk &amp; eggs/);
  } finally { s.done(); }
});
