/**
 * Site privacy check (issue #3): no real household data on a public page.
 *
 *   npm run check:site          scan the tree; exit 1 on any finding
 *   npm test                    the self-test (scripts/check-site.test.mjs)
 *
 * Scope: every git-tracked file plus everything under public/ (tracked or not),
 * including text hidden in PNG chunks and JPEG EXIF/comment segments, and the
 * file paths themselves.
 *
 * Rules, each reported as `file:line:col  rule  masked-value`:
 *   1. email address
 *   2. private or loopback IPv4 (10.x, 172.16-31.x, 192.168.x, 127.x)
 *   3. Home Assistant entity id (known domains) not in scripts/check-site.allowlist.json
 *   4. any string value from the real household config, when it exists on this machine
 *      (~/.homeroom/homeroom.local.json, or $HOMEROOM_LOCAL_CONFIG).
 *
 * Rule 4 ports the product's check-hygiene deny-list (scripts/hygiene-terms.ts there):
 * every string of 6+ characters in the real config becomes a term, generic words and
 * quick picks skipped. The terms are read at runtime and never written anywhere, and
 * every finding is masked, so a failing CI log can't leak the value it caught.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { inflateSync } from 'node:zlib';

const ROOT = join(import.meta.dirname, '..');
const DEFAULT_LOCAL_CONFIG = join(homedir(), '.homeroom', 'homeroom.local.json');

// Never scanned: tooling caches and the product checkout `npm run shots` makes.
const SKIP_DIRS = new Set(['.git', 'node_modules', '.cache']);
// Binary formats with no text worth scanning (fonts, archives).
const OPAQUE = /\.(woff2?|ttf|otf|eot|ico|gz|zip|br|mp4|webm|mov)$/i;

// ---------------------------------------------------------------- rules

export const RULES = {
  email: 'email address',
  ip: 'private or loopback IP',
  entity: 'Home Assistant entity id (not in allowlist)',
  config: 'value from the real household config',
};

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const PRIVATE_IP = new RegExp(
  `(?<![\\d.])(?:10\\.${OCTET}|127\\.${OCTET}|192\\.168|172\\.(?:1[6-9]|2\\d|3[01]))\\.${OCTET}\\.${OCTET}(?![\\d]|\\.\\d)`,
  'g',
);

// HA domains a household config names. The ambiguous ones read like ordinary code
// (`event.target`, `image.width`, `text.length`), so they only count with an `_` in
// the object id, which real entity ids for those domains nearly always have.
const HA_DOMAINS = [
  'alarm_control_panel', 'automation', 'binary_sensor', 'calendar', 'camera', 'climate', 'cover',
  'device_tracker', 'fan', 'humidifier', 'input_boolean', 'input_button', 'input_datetime',
  'input_number', 'input_select', 'input_text', 'lawn_mower', 'light', 'lock', 'media_player',
  'person', 'scene', 'sensor', 'siren', 'switch', 'todo', 'vacuum', 'valve', 'water_heater', 'weather', 'zone',
];
const HA_AMBIGUOUS = ['button', 'counter', 'event', 'group', 'image', 'notify', 'number', 'remote', 'script', 'select', 'text', 'timer', 'update'];
const ENTITY = new RegExp(`(?<![\\w.$/@-])(${[...HA_DOMAINS, ...HA_AMBIGUOUS].join('|')})\\.([a-z0-9_]+)(?![\\w(-]|\\.\\w)`, 'g');
const AMBIGUOUS = new Set(HA_AMBIGUOUS);
// `light.svg`, `camera.png`: a file name, not an entity.
const FILE_EXT = /^(js|mjs|cjs|ts|tsx|jsx|css|scss|svelte|html?|json|jsonc|md|txt|svg|png|jpe?g|webp|gif|avif|woff2?|sh|ya?ml|map|ico|xml)$/;

// ---------------------------------------------------------------- real-config deny-list (port of hygiene-terms.ts)

const GENERIC = /^(fake|ha|immich|familyhub|scene|script|toggle|light|climate|lock|garage|camera|development|production|test)$/;
// The product skips quick picks (#24 there). A public page is mostly prose, so the site also
// skips the subtrees that are tuning rather than identity (hub timings, curation words like
// "document", source kinds, locale) and enum-valued keys anywhere (`kind`, `icon`, meal `slots`).
const SKIPPED_PATHS = ['hub', 'curation', 'sources', 'env', 'tz', 'locale', 'units'];
const SKIPPED_KEYS = new Set(['kind', 'icon', 'slots']);

export function configTerms(config, vocabulary = new Set()) {
  const out = new Set();
  const visit = (v, path) => {
    if (SKIPPED_PATHS.some((p) => path === p || path.startsWith(`${p}.`))) return;
    if (SKIPPED_KEYS.has(path.slice(path.lastIndexOf('.') + 1))) return;
    if (typeof v === 'string' && vocabulary.has(v.trim())) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s.length >= 6 && !GENERIC.test(s)) out.add(s);
    } else if (Array.isArray(v)) v.forEach((x) => visit(x, path));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, path ? `${path}.${k}` : k);
  };
  visit(config, '');
  return [...out];
}

/** { path, terms } when the real config is on this machine, else { path, terms: null }. Throws if it exists but won't parse. */
export function loadDenyList(vocabulary, path = process.env.HOMEROOM_LOCAL_CONFIG || DEFAULT_LOCAL_CONFIG) {
  if (!existsSync(path)) return { path, terms: null };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    // Never echo the parse error: it quotes the file's contents.
    throw new Error(`check-site: the local config exists but isn't valid JSON (${displayPath(path)})`);
  }
  return { path, terms: configTerms(parsed, vocabulary) };
}

// ---------------------------------------------------------------- masking

/** Enough to find it, never enough to read it. */
export function mask(rule, value) {
  switch (rule) {
    case 'email': {
      const [user, domain] = value.split('@');
      const tld = domain.slice(domain.lastIndexOf('.'));
      return `${user[0]}•••@•••${tld}`;
    }
    case 'ip':
      return value.split('.').slice(0, 2).join('.') + '.•.•';
    case 'entity':
      return `${value.slice(0, value.indexOf('.') + 1)}•••`;
    default:
      return `[${value.length} chars masked]`;
  }
}

// ---------------------------------------------------------------- text extraction

/** Text segments to scan in one file: [{ where, text }]. `where` is null for the body, or a metadata label. */
export function extract(buf, name) {
  if (OPAQUE.test(name)) return [];
  if (isPng(buf)) return pngText(buf);
  if (isJpeg(buf)) return jpegText(buf);
  if (/\.(webp|gif|avif|pdf)$/i.test(name) || looksBinary(buf)) return [{ where: 'binary strings', text: printable(buf) }];
  return [{ where: null, text: buf.toString('utf8') }];
}

const isPng = (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a;
const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

function looksBinary(b) {
  const n = Math.min(b.length, 8000);
  for (let i = 0; i < n; i++) if (b[i] === 0) return true;
  return false;
}

/** Runs of 4+ printable ASCII characters, like `strings(1)`. */
function printable(b) {
  return (b.toString('latin1').match(/[\x20-\x7e]{4,}/g) ?? []).join('\n');
}

/** Every ancillary text-bearing PNG chunk: tEXt, zTXt, iTXt, eXIf (plus any unknown chunk's printable bytes). */
export function pngText(buf) {
  const out = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, Math.min(off + 8 + len, buf.length));
    off += 12 + len;
    if (type === 'IDAT' || type === 'IHDR' || type === 'PLTE' || type === 'IEND') continue;
    let text = '';
    try {
      if (type === 'tEXt') text = data.toString('latin1').replace('\0', ': ');
      else if (type === 'zTXt') {
        const k = data.indexOf(0);
        text = `${data.toString('latin1', 0, k)}: ${inflateSync(data.subarray(k + 2)).toString('latin1')}`;
      } else if (type === 'iTXt') {
        const k = data.indexOf(0);
        const compressed = data[k + 1] === 1;
        let p = k + 3;
        p = data.indexOf(0, p) + 1; // language tag
        p = data.indexOf(0, p) + 1; // translated keyword
        const body = data.subarray(p);
        text = `${data.toString('latin1', 0, k)}: ${(compressed ? inflateSync(body) : body).toString('utf8')}`;
      } else text = printable(data);
    } catch {
      text = printable(data);
    }
    if (text) out.push({ where: `png ${type}`, text });
  }
  return out;
}

/** JPEG APPn (EXIF, XMP, IPTC) and COM segments, as printable text. */
export function jpegText(buf) {
  const out = [];
  let off = 2;
  while (off + 4 <= buf.length && buf[off] === 0xff) {
    const marker = buf[off + 1];
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end of image
    const len = buf.readUInt16BE(off + 2);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (isApp || marker === 0xfe) {
      const text = printable(buf.subarray(off + 4, off + 2 + len));
      if (text) out.push({ where: marker === 0xfe ? 'jpeg COM' : `jpeg APP${marker - 0xe0}`, text });
    }
    off += 2 + len;
  }
  return out;
}

// ---------------------------------------------------------------- scanning

/**
 * Findings for one text segment. Lines and columns are 1-based. A metadata segment
 * reports its label in place of a line number, since "line 3 of an EXIF blob" helps no one.
 */
export function scanText(text, { allow, terms }) {
  const found = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const hit = (rule, value, col) => found.push({ rule, line: i + 1, col: col + 1, masked: mask(rule, value) });
    for (const m of line.matchAll(EMAIL)) hit('email', m[0], m.index);
    for (const m of line.matchAll(PRIVATE_IP)) hit('ip', m[0], m.index);
    for (const m of line.matchAll(ENTITY)) {
      const [id, domain, object] = m;
      if (FILE_EXT.test(object)) continue;
      if (AMBIGUOUS.has(domain) && !object.includes('_')) continue;
      if (allow.has(id)) continue;
      hit('entity', id, m.index);
    }
    if (terms) {
      for (const term of terms) {
        let at = line.indexOf(term);
        while (at !== -1) {
          hit('config', term, at);
          at = line.indexOf(term, at + term.length);
        }
      }
    }
  });
  return found;
}

/** Findings for one file (its body or metadata, plus its path). */
export function scanFile(abs, rel, ctx) {
  const findings = [];
  for (const f of scanText(rel.split(sep).join('/'), ctx)) findings.push({ ...f, file: rel, where: 'path' });
  let buf;
  try {
    buf = readFileSync(abs);
  } catch (e) {
    findings.push({ file: rel, rule: 'unreadable', line: 0, col: 0, where: null, masked: e.code ?? 'error' });
    return findings;
  }
  for (const seg of extract(buf, rel)) {
    for (const f of scanText(seg.text, ctx)) findings.push({ ...f, file: rel, where: seg.where });
  }
  return findings;
}

/** Tracked files, plus every file under public/. Paths relative to root. */
export function listFiles(root) {
  const files = new Set();
  try {
    // Tracked, plus untracked-but-not-ignored: a local run sees a new file before CI does.
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const f of out.split('\0')) if (f) files.add(f.split('/').join(sep));
  } catch {
    // Not a git checkout (a tarball, a temp dir): fall back to walking everything.
    for (const f of walk(root, root)) files.add(f);
  }
  for (const f of walk(join(root, 'public'), root)) files.add(f);
  return [...files].filter((f) => existsSync(join(root, f)) && !f.split(sep).some((p) => SKIP_DIRS.has(p))).sort();
}

function walk(dir, root) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    if (SKIP_DIRS.has(n)) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, root) : [relative(root, p)];
  });
}

/** { entities, vocabulary }: fixture entity ids, and generic words the deny-list never treats as terms. */
export function loadAllowlist(path = join(ROOT, 'scripts', 'check-site.allowlist.json')) {
  const { entities, vocabulary } = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(entities) || !Array.isArray(vocabulary)) throw new Error('check-site: the allowlist needs "entities" and "vocabulary" arrays');
  // A fixture entity id is public sample data, so it's never a deny-list term either: the real
  // config shares integration defaults like the Family Hub lists' stock `todo.*` ids.
  return { entities: new Set(entities), vocabulary: new Set([...vocabulary, ...entities]) };
}

export function scanTree(root, ctx) {
  return listFiles(root).flatMap((rel) => scanFile(join(root, rel), rel, ctx));
}

export function format(f) {
  const loc = f.where === null ? `${f.file}:${f.line}:${f.col}` : `${f.file} [${f.where}${f.where === 'path' ? '' : `:${f.line}`}]`;
  return `${loc}  ${f.rule}: ${RULES[f.rule] ?? f.rule}  ${f.masked}`;
}

function displayPath(p) {
  return p.startsWith(homedir()) ? `~${p.slice(homedir().length)}` : p;
}

// ---------------------------------------------------------------- CLI

function main() {
  const root = process.argv.includes('--root') ? process.argv[process.argv.indexOf('--root') + 1] : ROOT;
  const { entities, vocabulary } = loadAllowlist();
  const deny = loadDenyList(vocabulary);
  const ctx = { allow: entities, terms: deny.terms };
  if (deny.terms) console.log(`check-site: real-config deny-list loaded (${deny.terms.length} terms from ${displayPath(deny.path)}; values are never printed)`);
  else console.log(`check-site: no local config at ${displayPath(deny.path)}, so pattern rules only (expected in CI)`);

  const files = listFiles(root);
  const findings = files.flatMap((rel) => scanFile(join(root, rel), rel, ctx));
  if (findings.length) {
    console.error(`check-site: FAILED, ${findings.length} finding${findings.length === 1 ? '' : 's'} in ${new Set(findings.map((f) => f.file)).size} file(s)`);
    for (const f of findings) console.error(`  ${format(f)}`);
    console.error('Values are masked. Remove them, or (for a fake fixture entity id) add it to scripts/check-site.allowlist.json.');
    process.exit(1);
  }
  console.log(`check-site: clean (${files.length} files scanned)`);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'check-site: failed');
    process.exit(2);
  }
}
