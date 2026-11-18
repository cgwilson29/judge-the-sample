// Automated correctness checks for the shared sampling module and the data loader.
// Run with:  npm test
// These checks report pass/fail only. They never print the population's true mean or any
// sampling results.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePopulation, findGaps, timestampToMinute, groupRows, STRATA_COLUMNS, TARGET } from "../src/population.js";
import {
  mulberry32, mean, trueMean, srsIndices, sampleMean,
  systematicSample, proportionalAllocation, stratifiedSample, drawSingleSample,
} from "../src/sampling.js";
import { DEFAULTS } from "../src/config.js";

const csv = readFileSync(new URL("../data/heart_rate_week.csv", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url), "utf8")).datasets.heart;
const rows = parsePopulation(csv);
const values = rows.map((r) => r[TARGET]);
const N = rows.length;
const NON_DIVISOR = 7; // 9,864 / 7 is not a whole number
const DIVISOR = 8; // 9,864 / 8 = 1,233

function checkDistinct(idx, N, n) {
  assert.equal(idx.length, n, "exactly n rows");
  assert.equal(new Set(idx).size, n, "no row twice");
  for (const i of idx) assert.ok(Number.isInteger(i) && i >= 0 && i < N, "valid row index");
}

// ---------- Data loading ----------

test("data: every row of the CSV is loaded (N = 9,864), row_id 1..N in order", () => {
  assert.equal(N, csv.trim().split(/\r?\n/).length - 1);
  assert.equal(N, manifest.n_rows);
  rows.forEach((r, i) => assert.equal(r.row_id, i + 1));
});

test("data: heart_rate_bpm is parsed as a finite number in every row", () => {
  for (const v of values) assert.ok(typeof v === "number" && Number.isFinite(v));
});

test("data: timestamps convert to minutes and strictly increase (time order)", () => {
  assert.equal(timestampToMinute("2016-04-25 00:00"), 0);
  assert.equal(timestampToMinute("2016-05-01 23:59"), 7 * 1440 - 1);
  for (let i = 1; i < N; i++) assert.ok(rows[i].minute > rows[i - 1].minute);
});

test("data: gaps account for the documented missing minutes", () => {
  const gaps = findGaps(rows);
  const missing = gaps.reduce((s, g) => s + g.missing, 0);
  assert.equal(missing, manifest.missing_minutes); // 216
  // The documented longest gap (135) is the time between two consecutive readings.
  assert.equal(Math.max(...gaps.map((g) => g.toMinute - g.fromMinute)), manifest.longest_gap_minutes);
  assert.equal(N + missing, manifest.minutes_in_week);
});

test("strata: every column splits all N rows into non-overlapping groups", () => {
  for (const c of STRATA_COLUMNS) {
    const strata = groupRows(rows, c.key);
    const all = strata.flatMap((s) => s.indices);
    assert.equal(all.length, N, c.key);
    assert.equal(new Set(all).size, N, c.key);
  }
  assert.equal(groupRows(rows, "day").length, 7);
  assert.equal(groupRows(rows, "band").length, 4);
});

test("strata: activity_state group sizes match data/README.md", () => {
  const sizes = Object.fromEntries(groupRows(rows, "activity_state").map((s) => [s.label, s.indices.length]));
  assert.deepEqual(sizes, manifest.groups.activity_state); // exercise 1,049, rest 5,886, sleep 2,929
});

// ---------- Random number generator ----------

test("rng: same seed gives the same sequence; values in [0, 1)", () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 10000; i++) {
    const u = a();
    assert.equal(u, b());
    assert.ok(u >= 0 && u < 1);
  }
});

// ---------- Simple random sampling ----------

test("SRS: exactly n distinct rows for n = 1, 10, 100, a non-divisor of N, and N", () => {
  for (const n of [1, 10, 100, NON_DIVISOR, N]) checkDistinct(srsIndices(N, n, mulberry32(123)), N, n);
});

test("SRS: rejects n outside 1..N and non-whole n", () => {
  for (const n of [0, -1, N + 1, 2.5]) assert.throws(() => srsIndices(N, n, mulberry32(1)));
});

test("SRS: every set of n rows equally likely (N = 5, n = 2, 100,000 draws)", () => {
  const rng = mulberry32(2026);
  const counts = new Map();
  const draws = 100000;
  for (let k = 0; k < draws; k++) {
    const key = srsIndices(5, 2, rng).join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.equal(counts.size, 10);
  for (const c of counts.values()) assert.ok(Math.abs(c / draws - 0.1) < 0.005);
});

// ---------- Systematic sampling ----------

test("systematic: exactly n distinct rows for n = 1, 10, 100, a non-divisor and a divisor of N", () => {
  for (const n of [1, 10, 100, NON_DIVISOR, DIVISOR, N]) {
    const s = systematicSample(N, n, mulberry32(99));
    checkDistinct(s.indices, N, n);
  }
});

test("systematic: exactly n distinct rows within 1..N for EVERY n from 1 to N (2 seeds)", () => {
  for (const seed of [1, 2]) {
    for (let n = 1; n <= N; n++) {
      const s = systematicSample(N, n, mulberry32(seed + n));
      assert.equal(s.steps.length, n);
      let prev = 0;
      for (const st of s.steps) {
        assert.ok(st.row > prev && st.row <= N, `n = ${n}`);
        prev = st.row;
      }
    }
  }
});

test("systematic: whole-number design exactly when N/n is whole; rows follow r, r+k, r+2k, ...", () => {
  for (const n of [1, 2, 3, 4, DIVISOR, 24, 72, 137, N]) {
    assert.equal(N % n, 0);
    for (let seed = 0; seed < 20; seed++) {
      const s = systematicSample(N, n, mulberry32(seed));
      assert.equal(s.design, "whole");
      assert.equal(s.k, N / n);
      assert.ok(Number.isInteger(s.start) && s.start >= 1 && s.start <= s.k);
      s.steps.forEach((st, j) => assert.equal(st.row, s.start + j * s.k));
    }
  }
});

test("systematic: fractional design otherwise; u in (0, k], rows = ceil(u + j*k)", () => {
  for (const n of [10, 100, NON_DIVISOR, 9863]) {
    assert.notEqual(N % n, 0);
    for (let seed = 0; seed < 20; seed++) {
      const s = systematicSample(N, n, mulberry32(seed));
      assert.equal(s.design, "fractional");
      assert.ok(s.start > 0 && s.start <= s.k);
      s.steps.forEach((st, j) => assert.equal(st.row, Math.min(N, Math.ceil(s.start + j * s.k))));
    }
  }
});

test("systematic: start u = k (largest possible) still keeps every row within 1..N", () => {
  for (const n of [10, 100, NON_DIVISOR, 9863]) {
    const s = systematicSample(N, n, () => 0); // rng() = 0 gives u = k
    assert.equal(s.start, N / n);
    checkDistinct(s.indices, N, n);
  }
});

test("systematic: exact enumeration of all k starts (N = 10, n = 5): each start once, each row inclusion = n/N", () => {
  const k = 2;
  const seen = new Map();
  const included = new Array(10).fill(0);
  for (let r = 1; r <= k; r++) {
    const s = systematicSample(10, 5, () => (r - 0.5) / k); // forces start r
    assert.equal(s.start, r);
    seen.set(s.start, (seen.get(s.start) ?? 0) + 1);
    s.indices.forEach((i) => included[i]++);
  }
  assert.deepEqual([...seen.keys()], [1, 2]);
  for (const c of included) assert.equal(c / k, 5 / 10);
});

test("systematic: fractional design gives each row inclusion ≈ n/N (N = 10, n = 4, 200,000 draws)", () => {
  const rng = mulberry32(7);
  const draws = 200000;
  const included = new Array(10).fill(0);
  for (let d = 0; d < draws; d++) systematicSample(10, 4, rng).indices.forEach((i) => included[i]++);
  for (const c of included) assert.ok(Math.abs(c / draws - 0.4) < 0.01);
});

// ---------- Stratified sampling ----------

test("allocation: known answers", () => {
  assert.deepEqual(proportionalAllocation([5, 3, 2], 5).allocation, [3, 1, 1]); // largest remainder, tie to first
  assert.deepEqual(proportionalAllocation([98, 1, 1], 10).allocation, [8, 1, 1]); // at least 1 per stratum
  assert.deepEqual(proportionalAllocation([98, 1, 1], 3).allocation, [1, 1, 1]);
  assert.deepEqual(proportionalAllocation([1, 9], 10).allocation, [1, 9]); // never above stratum size
  assert.equal(proportionalAllocation([5, 3, 2], 2).ok, false); // n < number of strata
});

test("allocation: for every column and every n from H to N, whole numbers totalling n, 1 <= n_h <= N_h, weights sum to 1", () => {
  for (const c of STRATA_COLUMNS) {
    const sizes = groupRows(rows, c.key).map((s) => s.indices.length);
    const weightSum = sizes.reduce((s, x) => s + x / N, 0);
    assert.ok(Math.abs(weightSum - 1) < 1e-12, c.key);
    for (let n = 1; n <= N; n++) {
      const a = proportionalAllocation(sizes, n);
      if (n < sizes.length) {
        assert.equal(a.ok, false);
        continue;
      }
      assert.ok(a.ok);
      assert.equal(a.allocation.reduce((s, x) => s + x, 0), n, `${c.key}, n = ${n}`);
      a.allocation.forEach((x, h) => assert.ok(Number.isInteger(x) && x >= 1 && x <= sizes[h], `${c.key}, n = ${n}`));
    }
  }
});

test("stratified: weighted estimator gives the known answer on a small synthetic population", () => {
  // Stratum A: 6 rows of 10; stratum B: 2 rows of 40. n = 2 -> allocation [1, 1] (not proportional).
  const vals = [10, 10, 10, 10, 10, 10, 40, 40];
  const strata = [{ label: "A", indices: [0, 1, 2, 3, 4, 5] }, { label: "B", indices: [6, 7] }];
  const s = stratifiedSample(strata, vals, 2, mulberry32(5));
  assert.ok(s.ok);
  assert.deepEqual(s.strata.map((x) => x.n_h), [1, 1]);
  assert.deepEqual(s.strata.map((x) => x.weight), [0.75, 0.25]);
  assert.equal(s.estimate, 0.75 * 10 + 0.25 * 40); // 17.5
  assert.notEqual(s.estimate, sampleMean(vals, s.indices)); // plain average would be 25
});

test("stratified: exactly n distinct rows, each in its own stratum, matching the allocation (real data, every column)", () => {
  for (const c of STRATA_COLUMNS) {
    const strata = groupRows(rows, c.key);
    for (const n of [strata.length, 10, 100, NON_DIVISOR, 1000]) {
      const s = stratifiedSample(strata, values, n, mulberry32(11));
      assert.ok(s.ok);
      checkDistinct(s.indices, N, n);
      s.strata.forEach((p, h) => {
        assert.equal(p.indices.length, p.n_h);
        const members = new Set(strata[h].indices);
        for (const i of p.indices) assert.ok(members.has(i));
      });
      const wsum = s.strata.reduce((t, p) => t + p.weight, 0);
      assert.ok(Math.abs(wsum - 1) < 1e-12);
      const recomputed = s.strata.reduce((t, p) => t + (p.N_h / N) * sampleMean(values, p.indices), 0);
      assert.ok(Math.abs(s.estimate - recomputed) < 1e-9);
    }
  }
});

test("stratified: n smaller than the number of strata draws no sample", () => {
  const r = drawSingleSample({ method: "stratified", values, n: 5, seed: 1, strata: groupRows(rows, "day") });
  assert.equal(r.ok, false);
  assert.equal(r.H, 7);
});

// ---------- Reproducibility ----------

test("reproducibility: the same seed and settings give the same rows and estimate, for all three methods", () => {
  for (const method of ["srs", "systematic", "stratified"]) {
    for (const n of [1, 10, DEFAULTS.n, NON_DIVISOR]) {
      for (const c of STRATA_COLUMNS) {
        const strata = groupRows(rows, c.key);
        if (method === "stratified" && n < strata.length) continue;
        const a = drawSingleSample({ method, values, n, seed: DEFAULTS.seed, strata });
        const b = drawSingleSample({ method, values, n, seed: DEFAULTS.seed, strata });
        assert.deepEqual(a.indices, b.indices);
        assert.equal(a.estimate, b.estimate);
      }
    }
  }
});

// ---------- Means ----------

test("means: known answers on a small synthetic population", () => {
  const pop = [2, 4, 6, 8, 10];
  assert.equal(mean(pop), 6);
  assert.equal(trueMean(pop), 6);
  assert.equal(sampleMean(pop, [0, 4]), 6);
  assert.equal(sampleMean(pop, [1, 2]), 5);
  assert.throws(() => mean([]));
});

test("means: true mean uses all N rows (value not printed)", () => {
  let s = 0;
  for (const r of rows) s += r.heart_rate_bpm;
  assert.ok(Math.abs(trueMean(values) - s / N) < 1e-9);
});

// ---------- Repeated sampling (stage 4) ----------
// These checks never print experiment results.
import {
  repeatedSampling, summarizeEstimates, systematicEnumeration, systematicRowsFromStart, conditionSeed,
} from "../src/sampling.js";

const actStrata = groupRows(rows, "activity_state");

test("repeated: number of estimates equals the repetition count (100 and 1,000), all three methods", () => {
  for (const reps of [100, 1000]) {
    for (const method of ["srs", "systematic", "stratified"]) {
      const r = repeatedSampling({ method, values, n: 100, reps, seed: 3, strata: actStrata, strataKey: "activity_state" });
      assert.equal(r.type, "Monte Carlo");
      assert.equal(r.estimates.length, reps);
      assert.equal(r.count, reps);
      assert.equal(r.seed, 3);
    }
  }
});

test("repeated: each repetition is one sample of n distinct rows and its estimate is that sample's estimator", () => {
  const seed = 17, reps = 100;
  for (const n of [1, 10, 100]) {
    const r = repeatedSampling({ method: "srs", values, n, reps, seed });
    const rng = mulberry32(conditionSeed(seed, "srs", n));
    for (let i = 0; i < reps; i++) {
      const idx = srsIndices(N, n, rng);
      checkDistinct(idx, N, n);
      assert.equal(r.estimates[i], sampleMean(values, idx));
    }
  }
  {
    const r = repeatedSampling({ method: "systematic", values, n: 100, reps, seed });
    const rng = mulberry32(conditionSeed(seed, "systematic", 100));
    for (let i = 0; i < reps; i++) {
      const idx = systematicSample(N, 100, rng).indices;
      checkDistinct(idx, N, 100);
      assert.equal(r.estimates[i], sampleMean(values, idx));
    }
  }
  {
    const r = repeatedSampling({ method: "stratified", values, n: 100, reps, seed, strata: actStrata, strataKey: "activity_state" });
    const rng = mulberry32(conditionSeed(seed, "stratified", 100, "activity_state"));
    for (let i = 0; i < reps; i++) {
      const s = stratifiedSample(actStrata, values, 100, rng);
      checkDistinct(s.indices, N, 100);
      assert.equal(r.estimates[i], s.estimate); // population-weighted estimator
    }
  }
});

test("repeated: the same seed and settings reproduce the same estimates and summaries", () => {
  for (const method of ["srs", "systematic", "stratified"]) {
    const args = { method, values, n: 100, reps: 200, seed: DEFAULTS.seed, strata: actStrata, strataKey: "activity_state" };
    assert.deepEqual(repeatedSampling(args), repeatedSampling(args));
  }
  for (const n of [1, 10]) {
    const args = { method: "srs", values, n, reps: 100, seed: DEFAULTS.seed };
    assert.deepEqual(repeatedSampling(args), repeatedSampling(args));
  }
});

test("repeated: Experiment B's simple random n = 100 equals Experiment A's for the same seed and repetitions", () => {
  const a = repeatedSampling({ method: "srs", values, n: 100, reps: 100, seed: DEFAULTS.seed });
  const b = repeatedSampling({ method: "srs", values, n: 100, reps: 100, seed: DEFAULTS.seed });
  assert.deepEqual(a.estimates, b.estimates);
});

test("repeated: repetition count must be a whole number from 100 to 1,000", () => {
  for (const reps of [0, 99, 1001, 100.5, NaN]) {
    assert.throws(() => repeatedSampling({ method: "srs", values, n: 10, reps, seed: 1 }));
  }
});

test("exact enumeration: lists each of the k starts exactly once (N = 9,864, n = 8, k = 1,233)", () => {
  const { starts, estimates } = systematicEnumeration(values, 8);
  assert.equal(starts.length, 1233);
  assert.deepEqual(starts, Array.from({ length: 1233 }, (_, i) => i + 1));
  assert.equal(estimates.length, 1233);
  // every row appears in exactly one start's sample
  const seen = new Array(N).fill(0);
  for (const r of starts) systematicRowsFromStart(N, 8, r).forEach((i) => seen[i]++);
  assert.ok(seen.every((c) => c === 1));
});

test("exact enumeration: small population known answer, labelled exact with no seed", () => {
  const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // N = 12, n = 3, k = 4
  const r = repeatedSampling({ method: "systematic", values: vals, n: 3, reps: 100, seed: 1 });
  assert.equal(r.type, "exact");
  assert.equal(r.seed, null);
  assert.equal(r.count, 4);
  assert.deepEqual(r.starts, [1, 2, 3, 4]);
  assert.deepEqual(r.estimates, [5, 6, 7, 8]); // start r -> rows r, r+4, r+8 -> mean r+4
  assert.equal(r.trueMean, 6.5);
  assert.equal(r.bias, 0);
  assert.ok(Math.abs(r.sd - Math.sqrt(1.25)) < 1e-12);
  assert.ok(Math.abs(r.rmse - Math.sqrt(1.25)) < 1e-12);
});

test("summary: bias, SD, RMSE and MC s.e. match hand calculations", () => {
  // estimates 4, 6, 8, 10; true mean 5 -> mean 7, bias 2, SD = sqrt((9+1+1+9)/4) = sqrt(5),
  // RMSE = sqrt((1+1+9+25)/4) = 3, MC s.e. = sqrt(5)/2
  const s = summarizeEstimates([4, 6, 8, 10], 5);
  assert.equal(s.meanOfEstimates, 7);
  assert.equal(s.bias, 2);
  assert.ok(Math.abs(s.sd - Math.sqrt(5)) < 1e-12);
  assert.ok(Math.abs(s.rmse - 3) < 1e-12);
  assert.ok(Math.abs(s.mcse - Math.sqrt(5) / 2) < 1e-12);
  assert.ok(Math.abs(s.rmse ** 2 - (s.bias ** 2 + s.sd ** 2)) < 1e-12); // 9 = 4 + 5
});

test("summary: RMSE² = bias² + SD² (random lists, and real repeated-sampling output)", () => {
  const rng = mulberry32(31);
  for (let t = 0; t < 200; t++) {
    const est = Array.from({ length: 100 + Math.floor(rng() * 900) }, () => 50 + 40 * rng());
    const s = summarizeEstimates(est, 40 + 40 * rng());
    assert.ok(Math.abs(s.rmse ** 2 - (s.bias ** 2 + s.sd ** 2)) < 1e-9);
  }
  for (const method of ["srs", "systematic", "stratified"]) {
    const r = repeatedSampling({ method, values, n: 100, reps: 100, seed: 5, strata: actStrata, strataKey: "activity_state" });
    assert.ok(Math.abs(r.rmse ** 2 - (r.bias ** 2 + r.sd ** 2)) < 1e-9);
  }
});

test("summary: constant population gives bias = SD = RMSE = 0 for every method", () => {
  const vals = new Array(50).fill(70);
  const strata = [{ label: "a", indices: [...Array(20).keys()] }, { label: "b", indices: [...Array(30).keys()].map((i) => i + 20) }];
  for (const method of ["srs", "systematic", "stratified"]) {
    const r = repeatedSampling({ method, values: vals, n: 7, reps: 100, seed: 2, strata, strataKey: "x" });
    assert.ok(Math.abs(r.bias) < 1e-12 && r.sd < 1e-12 && r.rmse < 1e-12, method);
  }
});
