import { useEffect, useMemo, useState } from "react";
import { population, gaps } from "./data.js";
import { TARGET, STRATA_COLUMNS, groupRows } from "./population.js";
import { trueMean, drawSingleSample, isValidSeed, MAX_SEED } from "./sampling.js";
import { DEFAULTS, METHOD_NAMES, STRATUM_COLORS } from "./config.js";
import { VIRIDIS_GRADIENT } from "./colorScale.js";
import Timeline from "./Timeline.jsx";
import Controls from "./Controls.jsx";
import RulePanel, { dec, stepCalc } from "./RulePanel.jsx";
import Experiments from "./Experiments.jsx";
import Challenge from "./Challenge.jsx";

const fmt = (x) => x.toFixed(2);
const int = (x) => x.toLocaleString("en-US");

function parseWhole(text) {
  if (String(text).trim() === "") return NaN;
  return Number(text);
}

export default function App() {
  const [axisMode, setAxisMode] = useState("time");
  const [method, setMethod] = useState(DEFAULTS.method);
  const [nInput, setNInput] = useState(String(DEFAULTS.n));
  const [seedInput, setSeedInput] = useState(String(DEFAULTS.seed));
  const [strataColumn, setStrataColumn] = useState(DEFAULTS.strataColumn);
  const [revealed, setRevealed] = useState(null); // systematic step-through: null = all rows shown

  const values = useMemo(() => population.map((r) => r[TARGET]), []);
  const N = values.length;
  const mu = useMemo(() => trueMean(values), [values]);
  const bpmRange = useMemo(() => [Math.min(...values), Math.max(...values)], [values]);

  const n = parseWhole(nInput);
  const nValid = Number.isInteger(n) && n >= 1 && n <= N;
  const seed = parseWhole(seedInput);
  const seedValid = isValidSeed(seed);
  const nError = nValid ? null : `Enter a whole number from 1 to ${int(N)}.`;
  const seedError = seedValid ? null : `Enter a whole number from 0 to ${int(MAX_SEED)}.`;

  const column = STRATA_COLUMNS.find((c) => c.key === strataColumn);
  const strata = useMemo(() => groupRows(population, strataColumn), [strataColumn]);

  const result = useMemo(
    () => (nValid && seedValid ? drawSingleSample({ method, values, n, seed, strata }) : null),
    [method, values, n, seed, strata, nValid, seedValid],
  );

  // Any change of settings resets the step-through.
  useEffect(() => setRevealed(null), [result]);

  const stepping = method === "systematic" && revealed != null && result?.ok;
  const complete = result?.ok && (!stepping || revealed >= result.steps.length);
  const estimate = complete ? result.estimate : null;

  const sample = useMemo(() => {
    if (!result?.ok) return { indices: [] };
    if (result.method === "systematic") {
      const steps = revealed == null ? result.steps : result.steps.slice(0, revealed);
      const byIndex = new Map(result.steps.map((s) => [s.row - 1, s]));
      return {
        indices: steps.map((s) => s.row - 1),
        describe: (i) => [`j = ${byIndex.get(i).j}: ${stepCalc(result, byIndex.get(i))}`],
      };
    }
    if (result.method === "stratified") {
      const stratumOf = new Map();
      result.strata.forEach((s, h) => s.indices.forEach((i) => stratumOf.set(i, h)));
      return {
        indices: result.indices,
        borderColors: result.indices.map((i) => STRATUM_COLORS[stratumOf.get(i)]),
        describe: (i) => [`Stratum: ${result.strata[stratumOf.get(i)].label}`],
      };
    }
    return { indices: result.indices };
  }, [result, revealed]);

  const settingsText = !result?.ok
    ? "—"
    : method === "srs"
      ? "Without replacement"
      : method === "systematic"
        ? `${result.design === "whole" ? "Whole-number" : "Fractional"} interval design, k = ${dec(result.k)}, random start = ${dec(result.start)}, file row order`
        : `By ${column.name}; proportional allocation (largest remainder, at least 1 per stratum)`;

  const diff = estimate != null ? estimate - mu : null;
  const step = {
    start: () => setRevealed(0),
    next: () => setRevealed((r) => Math.min((r ?? 0) + 1, result.steps.length)),
    all: () => setRevealed(result.steps.length),
    stop: () => setRevealed(null),
  };

  return (
    <main>
      <header className="site-header">
        <h1>Judge the Sample</h1>
        <p className="subtitle">Wearable heart rate · one wearer's week · which sample would you trust?</p>
      </header>
      <p className="lead">
        Population: all <strong>{int(N)}</strong> recorded minutes in <code>data/heart_rate_week.csv</code> — one
        wearer's week, 25 April – 1 May 2016. Each point is one recorded minute; its colour shows that minute's heart
        rate.
      </p>

      <Controls
        N={N}
        method={method}
        setMethod={setMethod}
        nInput={nInput}
        setNInput={setNInput}
        nError={nError}
        seedInput={seedInput}
        setSeedInput={setSeedInput}
        seedError={seedError}
        strataColumn={strataColumn}
        setStrataColumn={setStrataColumn}
      />

      <h2 className="result-title">Current result: one single sample (not repeated sampling)</h2>
      <table className="readout">
        <tbody>
          <tr><th>Population</th><td>Baseline: all {int(N)} recorded minutes</td></tr>
          <tr><th>True population mean (all {int(N)} minutes)</th><td>{fmt(mu)} bpm</td></tr>
          <tr><th>Method</th><td>{METHOD_NAMES[method]}</td></tr>
          <tr><th>Settings</th><td>{settingsText}</td></tr>
          <tr><th>Seed</th><td>{seedValid ? seed : "—"}</td></tr>
          <tr><th>Sample size n</th><td>{nValid ? int(n) : "—"}</td></tr>
          <tr>
            <th>Sample estimate (this single sample)</th>
            <td>
              {estimate != null
                ? `${fmt(estimate)} bpm`
                : stepping
                  ? `shown when all rows are revealed (${int(revealed)} of ${int(n)} so far)`
                  : "no sample drawn"}
            </td>
          </tr>
          <tr>
            <th>Sample estimate − true population mean</th>
            <td>{diff != null ? `${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))} bpm` : "—"}</td>
          </tr>
        </tbody>
      </table>

      <fieldset className="axis-toggle">
        <legend>Horizontal axis</legend>
        <label>
          <input type="radio" name="axis" value="time" checked={axisMode === "time"} onChange={() => setAxisMode("time")} />{" "}
          Real time (missing minutes shown as shaded bands)
        </label>
        <label>
          <input type="radio" name="axis" value="row" checked={axisMode === "row"} onChange={() => setAxisMode("row")} />{" "}
          Row order (the order systematic sampling counts in; gaps marked by dashed lines)
        </label>
      </fieldset>

      <Timeline
        rows={population}
        sample={sample}
        gaps={gaps}
        axisMode={axisMode}
        trueMean={mu}
        sampleMean={estimate}
        sampleLabel={estimate != null ? `${METHOD_NAMES[method]} sample mean (single sample): ${fmt(estimate)} bpm` : ""}
        bpmRange={bpmRange}
      />

      <div className="legend">
        <span className="key">
          <span className="swatch-bar" style={{ background: VIRIDIS_GRADIENT }} />
          {bpmRange[0].toFixed(1)} → {bpmRange[1].toFixed(1)} bpm (point colour)
        </span>
        {method === "stratified" && result?.ok ? (
          result.strata.map((s, h) => (
            <span className="key" key={s.label}>
              <span className="dot" style={{ borderColor: STRATUM_COLORS[h] }} /> Sampled: {s.label}
            </span>
          ))
        ) : (
          <span className="key"><span className="swatch-sampled" /> Sampled minute (outlined)</span>
        )}
        <span className="key"><span className="swatch-line true" /> True population mean</span>
        <span className="key"><span className="swatch-line sample" /> Sample mean (single sample)</span>
        <span className="key"><span className="swatch-gap" /> Missing minutes (no reading)</span>
      </div>

      {result && (
        <RulePanel
          method={method}
          N={N}
          n={n}
          seed={seed}
          result={result}
          rows={population}
          revealed={revealed}
          step={step}
          columnName={column.name}
          colors={STRATUM_COLORS}
        />
      )}

      <section className="note">
        <h2>Row order in this file</h2>
        <p>
          Rows are in time order: row 1 is the first recorded minute (Mon 25 Apr 00:00) and row {int(N)} the last (Sun
          1 May 23:59). Minutes with no reading are absent, so row number is not time:{" "}
          {gaps.reduce((s, g) => s + g.missing, 0)} of the week's {int(7 * 1440)} minutes have no reading, in{" "}
          {gaps.length} gaps; the longest gap is {Math.max(...gaps.map((g) => g.toMinute - g.fromMinute))} minutes
          between two consecutive readings. In real-time view, short gaps are drawn at least 2 pixels wide so they
          remain visible.
        </p>
        <p>
          Systematic sampling counts rows in this file order. Here the file is a chronological record, so taking
          every k-th row means taking readings spread through the recorded sequence of the week. Interval sampling of
          an unordered list (one whose order has no meaning) is a different thing: there, every k-th row is simply
          every k-th entry in an arbitrary list.
        </p>
      </section>

      <Experiments values={values} rows={population} />

      <Challenge rows={population} />
    </main>
  );
}
