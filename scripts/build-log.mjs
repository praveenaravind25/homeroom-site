#!/usr/bin/env node
/* Build log: validate content/log/*.md and render it into the static site.
 *
 *   node scripts/build-log.mjs           validate, then write the entries into public/
 *   node scripts/build-log.mjs --check   validate, and fail if public/ is out of date (CI)
 *
 * No dependencies and no runtime server: the output is plain HTML committed under public/,
 * so the deploy path (wrangler publishes ./public as-is) doesn't change.
 * Entry shape: content/log/README.md. Voice and privacy rules: the pipeline's projects/site.md. */

import { readFileSync, writeFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = join(ROOT, 'content', 'log');
const PUBLIC = join(ROOT, 'public');
const PAGES = {
  log: join(PUBLIC, 'log', 'index.html'),     // every entry, newest first
  landing: join(PUBLIC, 'index.html'),        // the three newest, as cards
};
const TEASER_COUNT = 3;
const SHOT = { w: 1263, h: 841 };             // the wall tablet, landscape
const KEYS = new Set(['title', 'date', 'refs', 'screenshot', 'render', 'alt', 'before', 'before_alt', 'labels']);

/* ───────── Parse ───────── */

// A deliberately small front-matter reader: `key: value`, quoted values, and lists
// written as `key: [a, b]` or as `- item` lines under the key. Nothing else.
function parse(file, text) {
  const m = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { errors: ['no front matter (expected a --- block at the top)'] };
  const data = {}, errors = [];
  let listKey = null;
  for (const raw of m[1].split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const item = raw.match(/^\s+-\s*(.*)$/);
    if (item && listKey) { data[listKey].push(unquote(item[1])); continue; }
    const kv = raw.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) { errors.push(`can't read front matter line: "${raw.trim()}"`); continue; }
    const [, key, val] = kv;
    if (!KEYS.has(key)) errors.push(`unknown key "${key}" (allowed: ${[...KEYS].join(', ')})`);
    listKey = null;
    if (val === '') { data[key] = []; listKey = key; }
    else if (val.startsWith('[') && val.endsWith(']')) data[key] = val.slice(1, -1).split(',').map(unquote).filter(Boolean);
    else data[key] = unquote(val);
  }
  // The body is one paragraph: hard-wrapped lines join with a space.
  data.body = m[2].trim().replace(/\s*\n\s*/g, ' ');
  return { data, errors };
}
const unquote = s => s.trim().replace(/^(["'])(.*)\1$/, '$2').trim();

/* ───────── Validate ───────── */

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{20E3}]/u;
const URLISH = /:\/\/|^www\.|\b[a-z0-9-]+\.(com|org|net|io|dev|co|app)\b|^\//i;
// A sentence ends at . ? or ! followed by space and a capital, digit or opening quote,
// so "e.g. the" or "1263×841 px" don't split a sentence in two.
export const sentences = s => s.trim() ? s.trim().split(/(?<=[.?!]["'”’)]?)\s+(?=["'“‘(]?[A-Z0-9])/) : [];

function validate(slug, d, renders) {
  const errors = [];
  const prose = { title: d.title, body: d.body, alt: d.alt, before_alt: d.before_alt };

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.push('file name must be a lowercase slug, e.g. the-rail.md (it becomes the #anchor)');

  if (typeof d.title !== 'string' || !d.title) errors.push('missing title');
  else if ([...d.title].length > 60) errors.push(`title is ${[...d.title].length} characters (max 60)`);

  if (typeof d.date !== 'string' || !d.date) errors.push('missing date');
  else if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?Z)?$/.test(d.date) || isNaN(Date.parse(d.date))
           || new Date(d.date).toISOString().slice(0, 10) !== d.date.slice(0, 10))
    errors.push(`date "${d.date}" isn't ISO (YYYY-MM-DD, or YYYY-MM-DDTHH:MM:SSZ for the exact merge)`);

  if (!Array.isArray(d.refs) || !d.refs.length) errors.push('refs needs at least one item, e.g. "homeroom #44"');
  else d.refs.forEach(r => {
    if (URLISH.test(r)) errors.push(`ref "${r}" looks like a link; refs are plain text ("homeroom #44"), the product repo is private`);
    if (EMOJI.test(r)) errors.push(`ref "${r}" contains an emoji`);
  });

  const n = sentences(d.body || '').length;
  if (n < 2 || n > 4) errors.push(`body has ${n} sentence${n === 1 ? '' : 's'} (needs 2–4)`);
  if (d.body && !/[.?]["'”’)]?$/.test(d.body)) errors.push('body should end with a full stop');
  if (/<|\]\(|\*\*|^#/m.test(d.body || '')) errors.push('body is plain prose: no HTML or Markdown');

  for (const [k, v] of Object.entries(prose)) {
    if (typeof v !== 'string') continue;
    if (v.includes('!')) errors.push(`${k} has an exclamation mark`);
    if (EMOJI.test(v)) errors.push(`${k} has an emoji`);
  }

  for (const key of ['screenshot', 'before']) {
    const v = d[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || !/^\/assets\/log\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(v))
      errors.push(`${key} "${v}" should be a file under /assets/log/ (png, jpg or webp)`);
    else {
      const file = resolve(PUBLIC, '.' + v);
      if (!file.startsWith(PUBLIC + sep) || !existsSync(file)) errors.push(`${key} ${v} not found in public/`);
      else {
        const size = imageSize(readFileSync(file));
        if (!size) errors.push(`${key} ${v}: can't read its dimensions`);
        else if (size.w !== SHOT.w || size.h !== SHOT.h) errors.push(`${key} ${v} is ${size.w}×${size.h} (must be ${SHOT.w}×${SHOT.h})`);
      }
    }
  }
  // A before/after pair: `before` sits beside the screenshot (the after), each with its own alt.
  if (d.before !== undefined) {
    if (!d.screenshot) errors.push('before needs a screenshot (the after) to sit beside');
    if (!(typeof d.before_alt === 'string' && d.before_alt.length >= 10)) errors.push('before_alt is required with before (describe what a visitor would see)');
  } else if (d.before_alt !== undefined || d.labels !== undefined) errors.push('before_alt and labels only go with before');
  if (d.labels !== undefined && !(Array.isArray(d.labels) && d.labels.length === 2))
    errors.push('labels takes two short captions, before then after: [Corner ovals, Option D]');
  if (d.render !== undefined && !renders.has(d.render))
    errors.push(`render "${d.render}" isn't one the site can draw (${[...renders].join(', ')})`);
  if (d.screenshot && d.render) errors.push('use screenshot or render, not both');
  if ((d.screenshot || d.render) && !(typeof d.alt === 'string' && d.alt.length >= 10))
    errors.push('alt text is required with a screenshot or render (describe what a visitor would see)');
  if (d.alt && !d.screenshot && !d.render) errors.push('alt is set but there is no screenshot or render');

  return errors;
}

// Width × height from a PNG, JPEG or WebP header; null if it isn't one of those.
export function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1], len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  return null;
}

// The live renders hub.js can draw: its Rail screens and its sample photos (as the Wall).
function knownRenders() {
  const hub = readFileSync(join(PUBLIC, 'assets', 'hub.js'), 'utf8');
  const screens = [...hub.matchAll(/data-s="([a-z]+)"/g)].map(m => m[1]);
  const photos = [...(hub.match(/IMG\s*=\s*\{([\s\S]*?)\}/)?.[1] ?? '').matchAll(/^\s*([a-z]+)\s*:/gm)].map(m => 'wall:' + m[1]);
  return new Set([...screens, ...photos]);
}

/* ───────── Render ───────── */

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const longDate = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
// "homeroom #10", "homeroom #18", "site #2" → "homeroom #10, #18, site #2"
const refLine = refs => refs.map((r, i) => {
  const [, repo, rest] = r.match(/^(\S+)\s+(#.*)$/) || [];
  const prev = i && refs[i - 1].match(/^(\S+)\s+#/)?.[1];
  return repo && repo === prev ? rest : r;
}).join(', ');

// A screenshot if there is one, else a live render (a stand-in until #3's screenshots), else nothing:
// no empty frame, no broken image.
function media(e, cls = '') {
  if (e.screenshot) return `<img class="shot${cls}" src="${esc(e.screenshot)}" width="${SHOT.w}" height="${SHOT.h}" alt="${esc(e.alt)}" loading="lazy" decoding="async">`;
  if (e.render) return `<div class="fit${cls}" data-mini="${esc(e.render)}" role="img" aria-label="${esc(e.alt)}"></div>`;
  return '';
}

// Before and after, side by side under the text (two different photos, so a wipe would read as a slideshow).
// The landing teaser shows the after alone.
function pair(e) {
  const [b, a] = e.labels ?? [];
  const fig = (src, alt, lab, cap, i) => `
          <figure class="rv" style="--i:${i}"><img class="shot" src="${esc(src)}" width="${SHOT.w}" height="${SHOT.h}" alt="${esc(alt)}" loading="lazy" decoding="async"><figcaption><span class="lab">${lab}</span>${cap ? `<span>${esc(cap)}</span>` : ''}</figcaption></figure>`;
  return `
    <li class="entry" id="${e.slug}">
      <time datetime="${e.date}" class="rv">${longDate(e.date)}</time>
      <div class="body pair">
        <div class="rv" style="--i:1">
          <h2>${esc(e.title)}</h2>
          <p>${esc(e.body)}</p>
          <div class="ref">${esc(refLine(e.refs))}</div>
        </div>
        <div class="cmp">${fig(e.before, e.before_alt, 'Before', b, 1)}${fig(e.screenshot, e.alt, 'After', a, 2)}
        </div>
      </div>
    </li>`;
}

function renderLog(entries) {
  if (!entries.length) return `
  <p class="log-empty rv">Nothing logged yet. The first chapter lands here when it ships.</p>`;
  return `
  <ol class="entries">${entries.map(e => {
    if (e.before) return pair(e);
    const m = media(e, ' rv');
    return `
    <li class="entry" id="${e.slug}">
      <time datetime="${e.date}" class="rv">${longDate(e.date)}</time>
      <div class="body${m ? '' : ' solo'}">${m ? `
        ${m}` : ''}
        <div class="rv" style="--i:1">
          <h2>${esc(e.title)}</h2>
          <p>${esc(e.body)}</p>
          <div class="ref">${esc(refLine(e.refs))}</div>
        </div>
      </div>
    </li>`;
  }).join('')}
  </ol>`;
}

function renderTeaser(entries) {
  if (!entries.length) return '';   // no entries: the landing page skips the section; /log/ says so
  return `
  <section class="story" aria-labelledby="log-h">
    <span class="lab rv">Build log</span>
    <h2 class="h2 rv" id="log-h" style="--i:1">The story so far.</h2>
    <ul class="log3">${entries.slice(0, TEASER_COUNT).map((e, i) => `
      <li class="rv" style="--i:${i + 1}"><a class="logc pressable" href="/log/#${e.slug}">${media(e)}<div class="d">${longDate(e.date)}</div><h3>${esc(e.title)}</h3><div class="ref">${esc(refLine(e.refs))}</div></a></li>`).join('')}
    </ul>
    <a class="more-link pressable" href="/log/">The whole build log <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>
  </section>`;
}

// Replace what sits between <!-- build-log:NAME --> and <!-- /build-log:NAME -->.
function splice(html, name, inner, file) {
  const re = new RegExp(`(<!-- build-log:${name} -->)[\\s\\S]*?(\\n[ \\t]*<!-- /build-log:${name} -->)`);
  if (!re.test(html)) throw new Error(`${file}: missing the <!-- build-log:${name} --> … <!-- /build-log:${name} --> markers`);
  return html.replace(re, (_, open, close) => open + inner + close);
}

/* ───────── Main ───────── */

function main() {
  const check = process.argv.includes('--check');
  const rel = p => p.slice(ROOT.length + 1);
  const renders = knownRenders();
  const files = existsSync(LOG_DIR) ? readdirSync(LOG_DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort() : [];
  const entries = [], problems = [];

  for (const f of files) {
    const slug = f.replace(/\.md$/, '');
    const { data, errors } = parse(f, readFileSync(join(LOG_DIR, f), 'utf8'));
    const all = data ? [...errors, ...validate(slug, data, renders)] : errors;
    if (all.length) problems.push(...all.map(e => `content/log/${f}: ${e}`));
    else entries.push({ slug, ...data });
  }
  if (problems.length) {
    console.error(`Build log: ${problems.length} problem${problems.length > 1 ? 's' : ''}\n  ` + problems.join('\n  '));
    process.exit(1);
  }

  // Newest first. Same-day chapters fall back to the exact time if given, then the latest ref.
  const lastRef = e => Math.max(...e.refs.map(r => +(r.match(/#(\d+)/)?.[1] ?? 0)));
  entries.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || lastRef(b) - lastRef(a) || a.slug.localeCompare(b.slug));

  const out = [
    [PAGES.log, 'entries', renderLog(entries)],
    [PAGES.landing, 'teaser', renderTeaser(entries)],
  ];
  const stale = [];
  for (const [file, name, inner] of out) {
    const before = readFileSync(file, 'utf8');
    const after = splice(before, name, inner, rel(file));
    if (after === before) continue;
    if (check) stale.push(rel(file));
    else writeFileSync(file, after);
  }
  if (stale.length) {
    console.error(`Build log: ${stale.join(', ')} out of date. Run: node scripts/build-log.mjs`);
    process.exit(1);
  }
  console.log(`Build log: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} ok${check ? ', public/ up to date' : ', rendered'}.`);
}

// Run as a CLI, not when imported (the tests import `sentences`). realpath: /tmp and /var are symlinks on macOS.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main();
