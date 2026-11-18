// Shared sampling module: every calculation the app displays comes from here.
// Stage 3: simple random, systematic and stratified sampling (single samples).
// Stage 4 will add the repeated-sampling summary.

// ---------- Random numbers ----------

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

export const MAX_SEED = 4294967295;
export function isValidSeed(seed) {
  return Number.isInteger(seed) && seed >= 0 && seed <= MAX_SEED;
}

function checkSize(N, n) {
  if (!Number.isInteger(N) || N < 1) throw new Error(`N must be a positive whole number (got ${N})`);
  if (!Number.isInteger(n) || n < 1 || n > N) {
    throw new Error(`n must be a whole number from 1 to N = ${N} (got ${n})`);
  }
}

// ---------- Means ----------

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

// Sample mean: the mean of the target over the selected rows (0-based indices).
export function sampleMean(values, indices) {
  return mean(indices.map((i) => values[i]));
}

// ---------- Simple random sampling ----------

// n distinct row indices (0-based) out of N, WITHOUT replacement, every set of n rows equally
// likely (partial Fisher-Yates shuffle). Works for any 1 <= n <= N. Returned in ascending order.
export function srsIndices(N, n, rng) {
  checkSize(N, n);
  const idx = Array.from({ length: N }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (N - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).sort((a, b) => a - b);
}

// ---------- Systematic sampling with a random start (file row order) ----------

// Any 1 <= n <= N. Rows are 1-based positions in the file's row order.
// - Whole-number interval (N/n = k whole): start r uniform on 1..k, rows r, r+k, ..., (n rows).
// - Fractional interval: k = N/n, start u uniform on (0, k], rows ceil(u + j*k), j = 0..n-1.
// Both give exactly n distinct rows with inclusion probability n/N for every row.
// Returns { design, k, start, steps: [{ j, value, row }], indices } (indices are 0-based, ascending).
export function systematicSample(N, n, rng) {
  checkSize(N, n);
  const k = N / n;
  const steps = [];
  if (N % n === 0) {
    const r = 1 + Math.floor(rng() * k); // 1..k
    for (let j = 0; j < n; j++) {
      const row = r + j * k;
      steps.push({ j, value: row, row });
    }
    return { design: "whole", k, start: r, steps, indices: steps.map((s) => s.row - 1) };
  }
  const u = (1 - rng()) * k; // (0, k]
  let prev = 0;
  for (let j = 0; j < n; j++) {
    const value = u + j * k;
    // Guard against floating-point rounding pushing the last row past N.
    const row = Math.min(N, Math.ceil(value));
    if (row <= prev) throw new Error("systematic sample: rows not strictly increasing");
    steps.push({ j, value, row });
    prev = row;
  }
  return { design: "fractional", k, start: u, steps, indices: steps.map((s) => s.row - 1) };
}

// ---------- Stratified sampling ----------

// Proportional allocation with largest-remainder rounding, at least 1 per stratum and never more
// than the stratum size, whole numbers totalling exactly n.
// sizes = [N_1, ..., N_H]. Returns { ok: true, allocation, quotas } or { ok: false, reason } if n < H.
// Ties go to the first stratum in the given order.
export function proportionalAllocation(sizes, n) {
  const H = sizes.length;
  const N = sizes.reduce((s, x) => s + x, 0);
  if (H < 1 || sizes.some((s) => !Number.isInteger(s) || s < 1)) {
    throw new Error("every stratum must have at least one row");
  }
  checkSize(N, n);
  if (n < H) {
    return { ok: false, reason: `n = ${n} is smaller than the number of strata (${H}), so not every stratum can get at least one row.` };
  }
  const quotas = sizes.map((s) => (n * s) / N);
  const a = quotas.map((q, h) => Math.min(sizes[h], Math.max(1, Math.floor(q))));
  let total = a.reduce((s, x) => s + x, 0);
  while (total < n) {
    let best = -1;
    for (let h = 0; h < H; h++) {
      if (a[h] < sizes[h] && (best < 0 || quotas[h] - a[h] > quotas[best] - a[best])) best = h;
    }
    a[best]++;
    total++;
  }
  while (total > n) {
    let best = -1;
    for (let h = 0; h < H; h++) {
      if (a[h] > 1 && (best < 0 || quotas[h] - a[h] < quotas[best] - a[best])) best = h;
    }
    a[best]--;
    total--;
  }
  return { ok: true, allocation: a, quotas };
}

// strata = [{ label, indices }] (0-based row indices, fixed display order); values = target per row.
// Within each stratum: SRS without replacement, drawn in display order from the same generator.
// Estimate = population-weighted mean: sum over strata of (N_h / N) * (stratum sample mean).
export function stratifiedSample(strata, values, n, rng) {
  const sizes = strata.map((s) => s.indices.length);
  const N = sizes.reduce((s, x) => s + x, 0);
  const alloc = proportionalAllocation(sizes, n);
  if (!alloc.ok) return { ok: false, reason: alloc.reason, H: strata.length };
  const perStratum = strata.map((s, h) => {
    const N_h = sizes[h];
    const n_h = alloc.allocation[h];
    const local = srsIndices(N_h, n_h, rng);
    const indices = local.map((i) => s.indices[i]);
    const m = sampleMean(values, indices);
    const weight = N_h / N;
    return { label: s.label, N_h, n_h, quota: alloc.quotas[h], indices, mean: m, weight, contribution: weight * m };
  });
  const estimate = perStratum.reduce((s, p) => s + p.contribution, 0);
  const indices = perStratum.flatMap((p) => p.indices).sort((a, b) => a - b);
  return { ok: true, H: strata.length, strata: perStratum, indices, estimate };
}

// ---------- One single sample for the display ----------

// method: "srs" | "systematic" | "stratified". strata is needed for "stratified" only.
// Returns { ok, method, indices, estimate, ...method details } or { ok: false, reason }.
export function drawSingleSample({ method, values, n, seed, strata }) {
  const N = values.length;
  checkSize(N, n);
  if (!isValidSeed(seed)) throw new Error(`seed must be a whole number from 0 to ${MAX_SEED}`);
  const rng = mulberry32(seed);
  if (method === "srs") {
    const indices = srsIndices(N, n, rng);
    return { ok: true, method, indices, estimate: sampleMean(values, indices) };
  }
  if (method === "systematic") {
    const s = systematicSample(N, n, rng);
    return { ok: true, method, ...s, estimate: sampleMean(values, s.indices) };
  }
  if (method === "stratified") {
    return { method, ...stratifiedSample(strata, values, n, rng) };
  }
  throw new Error(`unknown method "${method}"`);
}
