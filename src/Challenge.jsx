// Stage 5: the student's challenge. The baseline population is never changed; the user's change (a
// shuffle of the row order) is applied to a labelled MODIFIED COPY. Every calculation comes from
// src/sampling.js; each result is measured against the true mean of the population it was drawn from.
import { useMemo, useState } from "react";
import { STRATA_COLUMNS, shuffledCopy, TARGET } from "./population.js";
import { mulberry32, trueMean, isValidSeed, MAX_SEED, MIN_REPS, MAX_REPS } from "./sampling.js";
import { runChallenge } from "./challenge.js";
import { DEFAULTS, METHOD_NAMES } from "./config.js";
import DotStrips from "./DotStrips.jsx";
import { dec } from "./RulePanel.jsx";
import { settingsText } from "./Experiments.jsx";

const STRATA_KEY = "band"; // the student's alternative: stratified by time-of-day band
const int = (x) => x.toLocaleString("en-US");
const f2 = (x) => x.toFixed(2);
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const signed = (x) => `${x >= 0 ? "+" : "−"}${f2(Math.abs(x))}`;
const parse = (t) => (String(t).trim() === "" ? NaN : Number(t));

function designText(N, n) {
  return N % n === 0
    ? `whole-number interval, k = ${int(N / n)} (exact enumeration of all ${int(N / n)} starts)`
    : `fractional interval, k = ${dec(N / n)} (Monte Carlo)`;
}

export default function Challenge({ rows }) {
  const column = STRATA_COLUMNS.find((c) => c.key === STRATA_KEY);
  const [shuffleSeedInput, setShuffleSeedInput] = useState("1");
  const [modified, setModified] = useState(null); // { rows, shuffleSeed } or null (= baseline only)
  const [nInput, setNInput] = useState(String(DEFAULTS.n));
  const [repsInput, setRepsInput] = useState(String(MIN_REPS));
  const [seedInput, setSeedInput] = useState(String(DEFAULTS.seed));
  const [result, setResult] = useState(null);

  const N = rows.length;
  const baseValues = useMemo(() => rows.map((r) => r[TARGET]), [rows]);
  const baseMean = useMemo(() => trueMean(baseValues), [baseValues]);
  // Recomputed from the modified copy's own rows whenever the copy changes.
  const modValues = useMemo(() => modified && modified.rows.map((r) => r[TARGET]), [modified]);
  const modMean = useMemo(() => modValues && trueMean(modValues), [modValues]);
  const modN = modified ? modified.rows.length : null;

  const shuffleSeed = parse(shuffleSeedInput);
  const shuffleSeedValid = isValidSeed(shuffleSeed);
  const n = parse(nInput);
  const H = column.levels.length;
  const nMax = Math.min(N, modN ?? N);
  const nValid = Number.isInteger(n) && n >= H && n <= nMax;
  const reps = parse(repsInput);
  const repsValid = Number.isInteger(reps) && reps >= MIN_REPS && reps <= MAX_REPS;
  const seed = parse(seedInput);
  const seedValid = isValidSeed(seed);
  const ready = modified && nValid && repsValid && seedValid;

  const apply = () => {
    setModified({ rows: shuffledCopy(rows, mulberry32(shuffleSeed)), shuffleSeed });
    setResult(null);
  };
  const backToBaseline = () => {
    setModified(null);
    setResult(null);
  };

  const run = () => {
    const popText = {
      baseline: `Baseline (all ${int(N)} minutes, original row order)`,
      modified: `Modified copy: rows shuffled (shuffle seed ${modified.shuffleSeed}), ${int(modN)} minutes`,
    };
    const conditions = runChallenge({
      baseRows: rows,
      modRows: modified.rows,
      shuffleSeed: modified.shuffleSeed,
      n,
      reps,
      seed,
      strataKey: STRATA_KEY,
    }).map((c) => ({
      ...c,
      name: `${c.method === "systematic" ? "Systematic" : "Stratified (time-of-day band)"} — ${c.populationLabel}`,
      popText: popText[c.populationLabel],
    }));
    setResult({ settings: { n, reps, seed, shuffleSeed: modified.shuffleSeed }, conditions });
  };

  const stale =
    result &&
    (!modified ||
      result.settings.n !== n ||
      result.settings.reps !== reps ||
      result.settings.seed !== seed ||
      result.settings.shuffleSeed !== modified.shuffleSeed);

  const stripRows = useMemo(
    () => result && result.conditions.map((c) => ({ name: c.name, populationLabel: c.populationLabel, ...c.result })),
    [result],
  );
  const allN = result && new Set(result.conditions.map((c) => c.result.n));

  return (
    <section className="experiments">
      <h2>Challenge: baseline vs modified population</h2>
      <p>
        Method challenged: <strong>{METHOD_NAMES.systematic}</strong>. Change: <strong>shuffle the row order</strong>{" "}
        of a copy of the population (a random permutation of all rows; each minute keeps its heart rate, timestamp and
        activity state). Alternative compared: <strong>stratified sampling by {column.name}</strong>. The original
        data file is not changed.
      </p>

      <h3>Step 1: the modified population</h3>
      <div className="controls">
        <fieldset>
          <legend>Shuffle row order (modified copy)</legend>
          <label>
            Shuffle seed{" "}
            <input type="number" min="0" max={MAX_SEED} step="1" value={shuffleSeedInput} onChange={(e) => setShuffleSeedInput(e.target.value)} aria-label="Shuffle seed" />
          </label>
          <button type="button" onClick={() => setShuffleSeedInput(String(Math.floor(Math.random() * 1e9)))}>New shuffle seed</button>
          <button type="button" onClick={apply} disabled={!shuffleSeedValid}>Apply: create shuffled copy</button>
          <button type="button" onClick={backToBaseline} disabled={!modified}>Return to baseline (remove modified copy)</button>
          {!shuffleSeedValid && <div className="error">Enter a whole number from 0 to {int(MAX_SEED)}.</div>}
        </fieldset>
      </div>

      <table className="readout">
        <tbody>
          <tr>
            <th>Baseline population (original row order)</th>
            <td>N = {int(N)}; true population mean (baseline) = {f2(baseMean)} bpm</td>
          </tr>
          <tr>
            <th>Modified population</th>
            <td>
              {modified
                ? `Rows shuffled (shuffle seed ${modified.shuffleSeed}); N = ${int(modN)}; true population mean (modified copy, recalculated from its own rows) = ${f2(modMean)} bpm`
                : "None — press Apply to create the modified copy"}
            </td>
          </tr>
        </tbody>
      </table>

      {modified && (
        <>
          <p className="hint">First 10 rows of the modified copy (row order is what systematic sampling counts):</p>
          <div className="table-wrap">
            <table className="alloc">
              <thead>
                <tr><th>Row in modified copy</th><th>Original row</th><th>Timestamp</th><th>Heart rate (bpm)</th><th>{column.name}</th></tr>
              </thead>
              <tbody>
                {modified.rows.slice(0, 10).map((r) => (
                  <tr key={r.row_id}>
                    <td>{r.row_id}</td>
                    <td>{r.orig_row_id}</td>
                    <td>{r.timestamp}</td>
                    <td>{r.heart_rate_bpm.toFixed(1)}</td>
                    <td>{column.of(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>Step 2: settings (the same for all four results)</h3>
      <div className="controls">
        <fieldset>
          <legend>Sample size n (rows in one sample)</legend>
          <input type="number" min={H} max={nMax} step="1" value={nInput} onChange={(e) => setNInput(e.target.value)} aria-label="Challenge sample size n" />
          <div className="hint">Same n for all four results. Stratified by {column.name} needs n ≥ {H}.</div>
          {!nValid && <div className="error">Enter a whole number from {H} to {int(nMax)}.</div>}
        </fieldset>
        <fieldset>
          <legend>Repetitions (separate samples per result)</legend>
          <input type="number" min={MIN_REPS} max={MAX_REPS} step="1" value={repsInput} onChange={(e) => setRepsInput(e.target.value)} aria-label="Challenge repetitions" />
          <button type="button" onClick={() => setRepsInput("100")}>100</button>
          <button type="button" onClick={() => setRepsInput("1000")}>1,000</button>
          {!repsValid && <div className="error">Enter a whole number from {MIN_REPS} to {int(MAX_REPS)}.</div>}
        </fieldset>
        <fieldset>
          <legend>Seed for the repetitions</legend>
          <input type="number" min="0" max={MAX_SEED} step="1" value={seedInput} onChange={(e) => setSeedInput(e.target.value)} aria-label="Challenge seed" />
          <button type="button" onClick={() => setSeedInput(String(Math.floor(Math.random() * 1e9)))}>New seed</button>
          {!seedValid && <div className="error">Enter a whole number from 0 to {int(MAX_SEED)}.</div>}
        </fieldset>
      </div>
      {nValid && (
        <p className="hint">
          Systematic design at n = {int(n)}: baseline (N = {int(N)}) — {designText(N, n)}
          {modified && <>; modified copy (N = {int(modN)}) — {designText(modN, n)}</>}. Baseline results use the same
          random streams as Experiment A, so matching settings give the same numbers as Experiment A.
        </p>
      )}

      <h3>Step 3: run the four results</h3>
      <button type="button" className="run" onClick={run} disabled={!ready}>Run challenge</button>
      {!modified && <span className="hint"> Create the modified copy first (Step 1).</span>}

      {result && (
        <div className="experiment-result">
          <h4>
            Challenge — n = {int(result.settings.n)} — {int(result.settings.reps)} repetitions — seed {result.settings.seed} —
            shuffle seed {result.settings.shuffleSeed}
          </h4>
          {stale && <p className="error">Settings or the modified copy changed since this result was run — press Run challenge to update it.</p>}
          <p className="hint">
            Distribution across repetitions (not a single sample). Each row is drawn against <strong>its own
            population's</strong> true mean. Diamond = mean of the estimates; bracket = ±1 SD. Same total n in all four:{" "}
            {allN.size === 1 ? "yes" : "NO"}.
          </p>
          <DotStrips rows={stripRows} perRowTrueMean ariaLabel="Challenge: estimates from each repetition, by population and method" />

          <div className="table-wrap">
            <table className="alloc">
              <thead>
                <tr>
                  <th>Result</th><th>Population</th><th>Method</th><th>Settings</th><th>Type</th><th>Seed</th><th>n</th>
                  <th>Repetitions (or starts)</th><th>True mean of its population</th><th>Mean of estimates</th><th>Bias</th>
                  <th>MC s.e. of bias</th><th>SD of estimates</th><th>RMSE</th>
                </tr>
              </thead>
              <tbody>
                {result.conditions.map(({ name, popText, result: r }) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="settings">{popText}</td>
                    <td>{METHOD_NAMES[r.method]}</td>
                    <td className="settings">{settingsText(r, column.name)}</td>
                    <td>{r.type}</td>
                    <td>{r.seed ?? "— (exact, no seed)"}</td>
                    <td>{int(r.n)}</td>
                    <td>{int(r.count)} {r.type === "exact" ? "starts" : "repetitions"}</td>
                    <td>{f2(r.trueMean)}</td>
                    <td>{f2(r.meanOfEstimates)}</td>
                    <td>{signed(r.bias)}</td>
                    <td>{r.type === "exact" ? "— (exact)" : f2(r.mcse)}</td>
                    <td>{f2(r.sd)}</td>
                    <td>{f2(r.rmse)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            All values in beats per minute. Bias = mean of estimates − the true mean of the population the samples were
            drawn from. SD divides by the number of repetitions; RMSE² = bias² + SD². MC s.e. of bias = SD / √repetitions.
          </p>

          <h4>Time-period coverage: average share of sampled rows in each {column.name.split(",")[0].toLowerCase()}</h4>
          <div className="table-wrap">
            <table className="alloc">
              <thead>
                <tr>
                  <th>Band</th>
                  <th>Population share (baseline)</th>
                  <th>Population share (modified)</th>
                  {result.conditions.map((c) => (
                    <th key={c.name}>Sampled share: {c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {column.levels.map((level, g) => (
                  <tr key={level}>
                    <td>{level}</td>
                    <td>{pct(result.conditions[0].result.coverage.populationShare[g])}</td>
                    <td>{pct(result.conditions[1].result.coverage.populationShare[g])}</td>
                    {result.conditions.map((c) => (
                      <td key={c.name}>{pct(c.result.coverage.sampleShare[g])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Sampled share = rows sampled in that band across all repetitions (or starts) ÷ (n × repetitions). Each
            result's shares come from its own samples only.
          </p>
        </div>
      )}
    </section>
  );
}
