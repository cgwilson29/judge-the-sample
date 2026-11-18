// Shared sampling module: every calculation the app displays comes from here.
// Stage 2 contains only what the temporary display needs. Stage 3 adds systematic and stratified
// sampling and their estimators; stage 4 adds the repeated-sampling summary.

// Seedable random number generator (mulberry32). Same seed -> same sequence of numbers in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Arithmetic mean of a list of numbers.
export function mean(values) {
  if (values.length === 0) throw new Error("mean of an empty list");
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

// True population mean: the mean of the target over ALL N rows.
export function trueMean(values) {
  return mean(values);
}

// Simple random sampling WITHOUT replacement: n distinct row indices (0-based) out of N,
// every set of n rows equally likely (partial Fisher-Yates shuffle). Works for any 1 <= n <= N.
// Returned in ascending row order.
export function srsIndices(N, n, rng) {
  if (!Number.isInteger(N) || N < 1) throw new Error(`N must be a positive whole number (got ${N})`);
  if (!Number.isInteger(n) || n < 1 || n > N) {
    throw new Error(`n must be a whole number from 1 to N = ${N} (got ${n})`);
  }
  const idx = Array.from({ length: N }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (N - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).sort((a, b) => a - b);
}

// Sample mean: the mean of the target over the selected rows.
export function sampleMean(values, indices) {
  return mean(indices.map((i) => values[i]));
}
