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

// ---------- Repeated sampling ----------

export const MIN_REPS = 100;
export const MAX_REPS = 1000;

// Each condition gets its own reproducible random stream from (seed, method, n, strata column), so
// the same condition always gets the same stream, whichever experiment runs it.
export function conditionSeed(seed, method, n, strataKey = "") {
  let h = 0x811c9dc5; // FNV-1a
  for (const ch of `${method}|${n}|${strataKey}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  h ^= seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

// Summary of R estimates against the true mean of the population they were drawn from.
// bias = mean of estimates - true mean; SD divides by R; RMSE = sqrt(mean of (estimate - true mean)^2);
// so RMSE^2 = bias^2 + SD^2. mcse = SD / sqrt(R) (Monte Carlo standard error of the mean of estimates).
export function summarizeEstimates(estimates, trueMeanValue) {
  const R = estimates.length;
  const m = mean(estimates);
  let ss = 0;
  let se = 0;
  for (const e of estimates) {
    ss += (e - m) ** 2;
    se += (e - trueMeanValue) ** 2;
  }
  const sd = Math.sqrt(ss / R);
  return { meanOfEstimates: m, bias: m - trueMeanValue, sd, rmse: Math.sqrt(se / R), mcse: sd / Math.sqrt(R) };
}

// Systematic sampling, whole-number interval: rows for a given start r (1..k).
export function systematicRowsFromStart(N, n, r) {
  checkSize(N, n);
  if (N % n !== 0) throw new Error("whole-number design needs N/n to be a whole number");
  const k = N / n;
  if (!Number.isInteger(r) || r < 1 || r > k) throw new Error(`start must be 1..${k}`);
  return Array.from({ length: n }, (_, j) => r + j * k - 1); // 0-based indices
}

// Exact enumeration for systematic sampling with a whole-number interval: all k starts, each once.
export function systematicEnumeration(values, n) {
  const N = values.length;
  const k = N / n;
  const starts = [];
  const estimates = [];
  for (let r = 1; r <= k; r++) {
    starts.push(r);
    estimates.push(sampleMean(values, systematicRowsFromStart(N, n, r)));
  }
  return { starts, estimates };
}

// Repeated sampling for one condition.
// - Systematic with a whole-number interval: EXACT enumeration of all k starts (no seed, no random draws).
// - Otherwise: MONTE CARLO, `reps` separate samples (each n distinct rows, without replacement) from a
//   seeded stream; a row may appear again in a later repetition.
// strataKey labels the stratification column (stratified only) and feeds the condition's seed.
// population: "" for the baseline; a label such as "modified:shuffle=123" for a modified copy. It feeds the
// condition's random stream, so baseline results match Experiment A for the same settings and a modified
// population gets its own stream.
// coverageGroups (optional): { levels, index } giving a group per row; the result then also reports, per
// group, the population share N_g/N and the average share of sampled rows across repetitions (or starts).
// It only counts the rows already drawn: it changes no random numbers and no estimates.
export function repeatedSampling({ method, values, n, reps, seed, strata, strataKey = "", population = "", coverageGroups = null }) {
  const N = values.length;
  checkSize(N, n);
  const mu = trueMean(values); // true mean of THIS population, from its own rows
  const base = { method, n, N, population, trueMean: mu, strataKey: method === "stratified" ? strataKey : "" };
  const counts = coverageGroups ? new Array(coverageGroups.levels.length).fill(0) : null;
  const take = (indices) => {
    if (counts) for (const i of indices) counts[coverageGroups.index[i]]++;
    return sampleMean(values, indices);
  };
  const coverage = (count) =>
    counts && {
      levels: coverageGroups.levels,
      populationShare: coverageGroups.levels.map((_, g) => coverageGroups.index.filter((x) => x === g).length / N),
      sampleShare: counts.map((c) => c / (n * count)),
    };

  if (method === "systematic" && N % n === 0) {
    const k = N / n;
    const starts = [];
    const estimates = [];
    for (let r = 1; r <= k; r++) {
      starts.push(r);
      estimates.push(take(systematicRowsFromStart(N, n, r)));
    }
    return { ...base, type: "exact", seed: null, count: k, starts, design: "whole", k, estimates, coverage: coverage(k), ...summarizeEstimates(estimates, mu) };
  }

  if (!Number.isInteger(reps) || reps < MIN_REPS || reps > MAX_REPS) {
    throw new Error(`repetitions must be a whole number from ${MIN_REPS} to ${MAX_REPS} (got ${reps})`);
  }
  if (!isValidSeed(seed)) throw new Error(`seed must be a whole number from 0 to ${MAX_SEED}`);
  const rng = mulberry32(conditionSeed(seed, method, n, base.strataKey + (population ? `|${population}` : "")));
  const estimates = new Array(reps);
  let extra = {};
  if (method === "srs") {
    for (let i = 0; i < reps; i++) estimates[i] = take(srsIndices(N, n, rng));
  } else if (method === "systematic") {
    for (let i = 0; i < reps; i++) estimates[i] = take(systematicSample(N, n, rng).indices);
    extra = { design: "fractional", k: N / n };
  } else if (method === "stratified") {
    const alloc = proportionalAllocation(strata.map((s) => s.indices.length), n);
    if (!alloc.ok) throw new Error(alloc.reason);
    for (let i = 0; i < reps; i++) {
      const s = stratifiedSample(strata, values, n, rng);
      if (counts) for (const j of s.indices) counts[coverageGroups.index[j]]++;
      estimates[i] = s.estimate; // population-weighted estimator
    }
    extra = { allocation: strata.map((s, h) => ({ label: s.label, N_h: s.indices.length, n_h: alloc.allocation[h] })) };
  } else {
    throw new Error(`unknown method "${method}"`);
  }
  return { ...base, type: "Monte Carlo", seed, count: reps, estimates, ...extra, coverage: coverage(reps), ...summarizeEstimates(estimates, mu) };
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
