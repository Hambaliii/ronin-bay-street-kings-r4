// random.js — seeded RNG (mulberry32)
let _s = 1;
export function srand(seed) { _s = (seed >>> 0) || 1; }
export function rnd() {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function rr(a, b) { return a + rnd() * (b - a); }
export function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
export function pick(arr) {
  if (!arr || !arr.length) return undefined; // Vice V3 sweep: empty-list guard (unchanged for non-empty lists)
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}
export function chance(p) { return rnd() < p; }
