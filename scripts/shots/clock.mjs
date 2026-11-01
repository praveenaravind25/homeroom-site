/**
 * Preloaded into the product server by `npm run shots` (node --import): pins
 * "now" and the RNG so two runs on one product commit render the same data.
 *
 * Time still flows (timers, timeouts and polls keep working); it just starts at
 * SHOTS_NOW. Math.random becomes mulberry32(SHOTS_SEED), the same PRNG the
 * product's curation uses in its own tests.
 */
const now = Date.parse(process.env.SHOTS_NOW ?? '');
if (!Number.isFinite(now)) throw new Error('shots/clock.mjs: SHOTS_NOW must be an ISO date-time');

const RealDate = Date;
const offset = now - RealDate.now();

class ShotsDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + offset);
    else super(...args);
  }
  static now() {
    return RealDate.now() + offset;
  }
}
globalThis.Date = ShotsDate;

let seed = Number(process.env.SHOTS_SEED ?? 1) >>> 0;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
