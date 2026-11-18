// Automated correctness checks for the shared sampling module and the data loader.
// Run with:  npm test
// These checks report pass/fail only. They never print the population's true mean.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePopulation, findGaps, timestampToMinute, TARGET } from "../src/population.js";
import { mulberry32, mean, trueMean, srsIndices, sampleMean } from "../src/sampling.js";
import { TEMP_SAMPLE } from "../src/config.js";

const csv = readFileSync(new URL("../data/heart_rate_week.csv", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url), "utf8")).datasets.heart;
const rows = parsePopulation(csv);
const values = rows.map((r) => r[TARGET]);

// ---------- Data loading ----------

test("every row of the CSV is loaded", () => {
  const dataLines = csv.trim().split(/\r?\n/).length - 1; // minus the header
  assert.equal(rows.length, dataLines);
  assert.equal(rows.length, manifest.n_rows); // 9,864
});

test("row_id runs 1..N in file order", () => {
  rows.forEach((r, i) => assert.equal(r.row_id, i + 1));
});

test("the target heart_rate_bpm is parsed as a finite number in every row", () => {
  for (const v of values) {
    assert.equal(typeof v, "number");
    assert.ok(Number.isFinite(v));
  }
});

test("timestamps convert to minutes and strictly increase (time order)", () => {
  assert.equal(timestampToMinute("2016-04-25 00:00"), 0);
  assert.equal(timestampToMinute("2016-05-01 23:59"), 7 * 1440 - 1);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].minute > rows[i - 1].minute);
});

test("gaps account for the documented missing minutes", () => {
  const gaps = findGaps(rows);
  const missing = gaps.reduce((s, g) => s + g.missing, 0);
  assert.equal(missing, manifest.missing_minutes); // 216
  // The documented "longest gap" (135) is the time between two consecutive readings;
  // the minutes with no reading inside it are one fewer.
  const longestStep = Math.max(...gaps.map((g) => g.toMinute - g.fromMinute));
  assert.equal(longestStep, manifest.longest_gap_minutes); // 135
  assert.equal(Math.max(...gaps.map((g) => g.missing)), manifest.longest_gap_minutes - 1);
  assert.equal(rows.length + missing, manifest.minutes_in_week); // 10,080
});

// ---------- Random number generator ----------

test("same seed gives the same random sequence", () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 1000; i++) assert.equal(a(), b());
});

test("random numbers lie in [0, 1)", () => {
  const r = mulberry32(7);
  for (let i = 0; i < 10000; i++) {
    const u = r();
    assert.ok(u >= 0 && u < 1);
  }
});

// ---------- Simple random sampling without replacement ----------

function checkSample(idx, N, n) {
  assert.equal(idx.length, n, "exactly n rows");
  assert.equal(new Set(idx).size, n, "no row twice");
  for (const i of idx) assert.ok(Number.isInteger(i) && i >= 0 && i < N, "valid row index");
}

test("the app's temporary sample has exactly 100 distinct rows of the population", () => {
  const idx = srsIndices(rows.length, TEMP_SAMPLE.n, mulberry32(TEMP_SAMPLE.seed));
  assert.equal(TEMP_SAMPLE.n, 100);
  checkSample(idx, rows.length, 100);
});

test("the same seed gives the same rows (app's temporary sample)", () => {
  const a = srsIndices(rows.length, TEMP_SAMPLE.n, mulberry32(TEMP_SAMPLE.seed));
  const b = srsIndices(rows.length, TEMP_SAMPLE.n, mulberry32(TEMP_SAMPLE.seed));
  assert.deepEqual(a, b);
});

test("SRS gives n distinct rows for n = 1, 10, 100 and N", () => {
  const N = rows.length;
  for (const n of [1, 10, 100, N]) checkSample(srsIndices(N, n, mulberry32(123)), N, n);
});

test("SRS rejects n outside 1..N and non-whole n", () => {
  for (const n of [0, -1, rows.length + 1, 2.5]) {
    assert.throws(() => srsIndices(rows.length, n, mulberry32(1)));
  }
});

test("SRS makes every set of n rows equally likely (N = 5, n = 2, 100,000 draws)", () => {
  const rng = mulberry32(2026);
  const counts = new Map();
  const draws = 100000;
  for (let k = 0; k < draws; k++) {
    const key = srsIndices(5, 2, rng).join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.equal(counts.size, 10); // C(5,2) = 10 possible samples, all seen
  for (const c of counts.values()) assert.ok(Math.abs(c / draws - 0.1) < 0.005); // each ≈ 1/10
});

// ---------- Means (known answers on a small synthetic population) ----------

test("mean, trueMean and sampleMean give known answers", () => {
  const pop = [2, 4, 6, 8, 10];
  assert.equal(mean(pop), 6);
  assert.equal(trueMean(pop), 6);
  assert.equal(sampleMean(pop, [0, 4]), 6);
  assert.equal(sampleMean(pop, [1, 2]), 5);
  assert.throws(() => mean([]));
});

test("true mean of the real data is a finite number within the data's range (value not printed)", () => {
  const mu = trueMean(values);
  assert.ok(Number.isFinite(mu));
  assert.ok(mu >= Math.min(...values) && mu <= Math.max(...values));
});

test("trueMean uses all N rows: equals the plain sum over every row divided by N", () => {
  let s = 0;
  for (const r of rows) s += r.heart_rate_bpm;
  assert.ok(Math.abs(trueMean(values) - s / rows.length) < 1e-9);
});
