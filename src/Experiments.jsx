import { useMemo, useState } from "react";
import { STRATA_COLUMNS, groupRows } from "./population.js";
import { repeatedSampling, isValidSeed, MAX_SEED, MIN_REPS, MAX_REPS } from "./sampling.js";
import { DEFAULTS, METHOD_NAMES } from "./config.js";
import DotStrips from "./DotStrips.jsx";
import { dec } from "./RulePanel.jsx";

const int = (x) => x.toLocaleString("en-US");
const f2 = (x) => x.toFixed(2);
const signed = (x) => `${x >= 0 ? "+" : "−"}${f2(Math.abs(x))}`;
const parse = (t) => (String(t).trim() === "" ? NaN : Number(t));

export function settingsText(r, columnName) {
  if (r.method === "srs") return "Without replacement";
  if (r.method === "systematic") {
    return r.type === "exact"
      ? `Whole-number interval, k = ${int(r.k)}, all ${int(r.count)} starts, file row order`
      : `Fractional interval, k = ${dec(r.k)}, new random start each repetition, file row order`;
  }
  return `By ${columnName}; proportional allocation (largest remainder, ≥1 per stratum): ${r.allocation
    .map((a) => `${a.label} ${a.n_h}`)
    .join(", ")}`;
}

function ResultBlock({ title, conditions, N, stale }) {
  const trueMean = conditions[0].result.trueMean;
  const stripRows = useMemo(() => conditions.map((c) => ({ name: c.name, ...c.result })), [conditions]);
  return (
    <div className="experiment-result">
      <h4>{title}</h4>
      {stale && <p className="error">Settings changed since this result was run — press Run to update it.</p>}
      <p className="hint">
        Population: baseline (all {int(N)} minutes). Distribution across repetitions — each dot is the estimate
        from one separate sample. Diamond = mean of the estimates; bracket = ±1 SD of the estimates.
      </p>
      <DotStrips
        rows={stripRows}
        trueMean={trueMean}
        ariaLabel={`${title}: estimates from each repetition, by condition`}
      />
      <div className="table-wrap">
        <table className="alloc">
          <thead>
            <tr>
              <th>Condition</th>
              <th>Method</th>
              <th>Settings</th>
              <th>Type</th>
              <th>Seed</th>
              <th>n</th>
              <th>Repetitions (or starts)</th>
              <th>True population mean</th>
              <th>Mean of estimates</th>
              <th>Bias</th>
              <th>MC s.e. of bias</th>
              <th>SD of estimates</th>
              <th>RMSE</th>
            </tr>
          </thead>
          <tbody>
            {conditions.map(({ name, result: r, columnName, note }) => (
              <tr key={name}>
                <td>
                  {name}
                  {note && <div className="hint">{note}</div>}
                </td>
                <td>{METHOD_NAMES[r.method]}</td>
                <td className="settings">{settingsText(r, columnName)}</td>
                <td>{r.type}</td>
                <td>{r.seed ?? "— (exact, no seed)"}</td>
                <td>{int(r.n)}</td>
                <td>
                  {int(r.count)} {r.type === "exact" ? "starts" : "repetitions"}
                </td>
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
        All values in beats per minute. Bias = mean of estimates − true population mean. SD = spread of the estimates
        across repetitions (dividing by the number of repetitions). RMSE = √(mean of (estimate − true mean)²), the
        typical estimation error combining bias and spread (RMSE² = bias² + SD²). MC s.e. of bias = SD / √repetitions.
      </p>
    </div>
  );
}

export default function Experiments({ values, rows }) {
  const N = values.length;
  const [repsInput, setRepsInput] = useState(String(MIN_REPS));
  const [seedInput, setSeedInput] = useState(String(DEFAULTS.seed));
  const [strataColumn, setStrataColumn] = useState(DEFAULTS.strataColumn);
  const [resA, setResA] = useState(null);
  const [resB, setResB] = useState(null);

  const reps = parse(repsInput);
  const repsValid = Number.isInteger(reps) && reps >= MIN_REPS && reps <= MAX_REPS;
  const seed = parse(seedInput);
  const seedValid = isValidSeed(seed);
  const ready = repsValid && seedValid;
  const column = STRATA_COLUMNS.find((c) => c.key === strataColumn);
  const strata = useMemo(() => groupRows(rows, strataColumn), [rows, strataColumn]);

  const runA = () => {
    const common = { values, n: 100, reps, seed };
    setResA({
      settings: { reps, seed, strataColumn },
      conditions: [
        { name: "Simple random", result: repeatedSampling({ ...common, method: "srs" }) },
        { name: "Systematic", result: repeatedSampling({ ...common, method: "systematic" }) },
        {
          name: "Stratified",
          columnName: column.name,
          result: repeatedSampling({ ...common, method: "stratified", strata, strataKey: strataColumn }),
        },
      ],
    });
  };

  const runB = () => {
    const common = { values, reps, seed, method: "srs" };
    // Reuse Experiment A's simple random n = 100 result when population and settings match.
    const a = resA?.conditions[0].result;
    const reuse = a && a.seed === seed && a.count === reps && a.n === 100;
    setResB({
      settings: { reps, seed },
      conditions: [
        { name: "n = 1", result: repeatedSampling({ ...common, n: 1 }) },
        { name: "n = 10", result: repeatedSampling({ ...common, n: 10 }) },
        {
          name: "n = 100",
          result: reuse ? a : repeatedSampling({ ...common, n: 100 }),
          note: reuse ? "Same result as Experiment A (simple random, same settings)" : null,
        },
      ],
    });
  };

  const staleA = resA && (resA.settings.reps !== reps || resA.settings.seed !== seed || resA.settings.strataColumn !== strataColumn);
  const staleB = resB && (resB.settings.reps !== reps || resB.settings.seed !== seed);

  return (
    <section className="experiments">
      <h2>Repeated sampling experiments (distribution of estimates across many samples)</h2>
      <p>
        These results are <strong>not</strong> a single sample. Each condition draws many separate samples of n rows
        (each without replacement; a row can appear again in a later repetition) and records one estimate per
        sample. <strong>n</strong> is the number of rows in one sample; <strong>repetitions</strong> is how many
        separate samples are drawn.
      </p>
      <p className="hint">
        100 repetitions usually reveal the main pattern; 1,000 give smoother distributions and more stable bias, SD
        and RMSE estimates. Neither guarantees stable results, and 100 repetitions cannot reliably separate small
        differences between methods. Rerun with different seeds to check whether your main conclusions hold. These
        sampling designs, with their estimators, are unbiased for the population mean, so a nonzero bias in a Monte
        Carlo result may be simulation noise; it is not guaranteed to be small.
      </p>

      <div className="controls">
        <fieldset>
          <legend>Repetitions (separate samples per condition)</legend>
          <input type="number" min={MIN_REPS} max={MAX_REPS} step="1" value={repsInput} onChange={(e) => setRepsInput(e.target.value)} aria-label="Repetitions" />
          <button type="button" onClick={() => setRepsInput("100")}>100</button>
          <button type="button" onClick={() => setRepsInput("1000")}>1,000</button>
          {!repsValid && <div className="error">Enter a whole number from {MIN_REPS} to {int(MAX_REPS)}.</div>}
        </fieldset>
        <fieldset>
          <legend>Seed for the experiments</legend>
          <input type="number" min="0" max={MAX_SEED} step="1" value={seedInput} onChange={(e) => setSeedInput(e.target.value)} aria-label="Experiment seed" />
          <button type="button" onClick={() => setSeedInput(String(Math.floor(Math.random() * 1e9)))}>New seed</button>
          {!seedValid && <div className="error">Enter a whole number from 0 to {int(MAX_SEED)}.</div>}
        </fieldset>
        <fieldset>
          <legend>Stratify by (Experiment A)</legend>
          <select value={strataColumn} onChange={(e) => setStrataColumn(e.target.value)} aria-label="Experiment A stratification column">
            {STRATA_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
        </fieldset>
      </div>

      <h3>Experiment A: three methods at n = 100</h3>
      <p>Simple random, systematic and stratified sampling, each with n = 100, on the same (baseline) population.</p>
      <button type="button" className="run" onClick={runA} disabled={!ready}>Run Experiment A</button>
      {resA && (
        <ResultBlock
          title={`Experiment A — n = 100 — ${int(resA.settings.reps)} repetitions — seed ${resA.settings.seed}`}
          conditions={resA.conditions}
          N={N}
          stale={staleA}
        />
      )}

      <h3>Experiment B: sample size (simple random, n = 1, 10 and 100)</h3>
      <p>Simple random sampling only, on the same (baseline) population; only n changes.</p>
      <button type="button" className="run" onClick={runB} disabled={!ready}>Run Experiment B</button>
      {resB && (
        <ResultBlock
          title={`Experiment B — simple random — ${int(resB.settings.reps)} repetitions — seed ${resB.settings.seed}`}
          conditions={resB.conditions}
          N={N}
          stale={staleB}
        />
      )}
    </section>
  );
}
