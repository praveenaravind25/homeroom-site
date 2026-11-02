// Tests for `npm run shots -- --photo <name>`: only an owner-approved photo gets onto the Wall.
// Run: node --test scripts/shots.test.mjs  (no product clone, no browser: the guard runs before either)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ownerPhoto } from './shots.mjs';

// A minimal JPEG header: SOI, then an SOF0 that says 1600×1067.
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0x2b, 0x06, 0x40, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);

function folder() {
  const root = mkdtempSync(join(tmpdir(), 'shots-photo-'));
  const dir = join(root, 'owner');
  mkdirSync(dir);
  writeFileSync(join(dir, 'owner-03.jpg'), jpeg);
  writeFileSync(join(root, 'elsewhere.jpg'), jpeg);
  return { root, dir, done: () => rmSync(root, { recursive: true, force: true }) };
}

test('accepts an owner photo by name and reads its size', () => {
  const f = folder();
  try {
    const p = ownerPhoto('owner-03', f.dir);
    assert.equal(p.name, 'owner-03');
    assert.deepEqual([p.width, p.height], [1600, 1067]);
  } finally { f.done(); }
});

test('the committed owner photos all pass', () => {
  for (const n of ['01', '02', '03', '04', '05', '06', '07']) assert.ok(ownerPhoto(`owner-${n}`).width > 0);
});

test('rejects anything that is not an owner photo name', () => {
  const f = folder();
  try {
    for (const bad of ['../elsewhere', 'owner-03.jpg', '/etc/passwd', 'harbour-dusk', 'owner-3', 'owner-03/..', ''])
      assert.throws(() => ownerPhoto(bad, f.dir), /takes an owner photo's name/, bad);
  } finally { f.done(); }
});

test('fails loudly on a missing file', () => {
  const f = folder();
  try {
    assert.throws(() => ownerPhoto('owner-09', f.dir), /no source-photos\/owner\/owner-09.jpg/);
  } finally { f.done(); }
});

test('rejects a symlink that leads out of the folder', () => {
  const f = folder();
  try {
    symlinkSync(join(f.root, 'elsewhere.jpg'), join(f.dir, 'owner-04.jpg'));
    assert.throws(() => ownerPhoto('owner-04', f.dir), /not a plain file/);
  } finally { f.done(); }
});

test('rejects a file that is not a JPEG', () => {
  const f = folder();
  try {
    writeFileSync(join(f.dir, 'owner-05.jpg'), 'not an image');
    assert.throws(() => ownerPhoto('owner-05', f.dir), /not a readable JPEG/);
  } finally { f.done(); }
});
