// Explains the current selection rule with the actual numbers of the current sample.
// It only DISPLAYS values computed in src/sampling.js.

const int = (x) => x.toLocaleString("en-US");
// Shows a number with up to `d` decimals; adds "…" if the shown value is rounded.
export function dec(x, d = 4) {
  if (Number.isInteger(x)) return int(x);
  const s = x.toFixed(d).replace(/\.?0+$/, "");
  return Number(s) === x ? s : `${s}…`;
}

export function stepCalc(result, s) {
  return result.design === "whole"
    ? `${result.start} + ${s.j} × ${int(result.k)} = ${int(s.row)}`
    : `ceil(${dec(result.start)} + ${s.j} × ${dec(result.k)}) = ceil(${dec(s.value)}) = ${int(s.row)}`;
}

function SrsRule({ N, n, seed }) {
  return (
    <>
      <p>
        <strong>Rule:</strong> choose {int(n)} different rows from all {int(N)} rows, <em>without replacement</em>{" "}
        (no row can be chosen twice). Every possible set of {int(n)} rows is equally likely. The seeded random
        number generator (seed {seed}) makes the choice.
      </p>
      <p>Estimate = sample mean = the plain average heart rate of the {int(n)} chosen minutes.</p>
    </>
  );
}

function SystematicRule({ N, n, seed, result, rows, revealed, step }) {
  const { design, k, start, steps } = result;
  const shown = revealed == null ? steps : steps.slice(0, revealed);
  return (
    <>
      <p>
        <strong>Rule:</strong> count rows in the file's row order and take every k-th row after a random start.
      </p>
      <ul>
        <li>
          Interval k = N / n = {int(N)} / {int(n)} = <strong>{dec(k)}</strong>
        </li>
        {design === "whole" ? (
          <li>
            k is a whole number, so the <strong>whole-number interval design</strong> is in use: random start r ={" "}
            <strong>{start}</strong>, chosen from 1 to {int(k)} (seed {seed}). Rows r, r + k, r + 2k, … ({int(n)} rows).
          </li>
        ) : (
          <li>
            k is not a whole number, so the <strong>fractional-interval design</strong> is in use: random start u ={" "}
            <strong>{dec(start)}</strong>, uniform between 0 and {dec(k)} (seed {seed}). Rows = ceil(u + j × k) for j =
            0 to {int(n - 1)} (ceil rounds up to the next whole row number).
          </li>
        )}
        <li>
          Both designs give exactly {int(n)} different rows, and every row has the same chance of selection, n / N ={" "}
          {int(n)} / {int(N)}.
        </li>
      </ul>

      <div className="stepper">
        {revealed == null ? (
          <button type="button" onClick={step.start}>Step through the rows one at a time</button>
        ) : (
          <>
            <button type="button" onClick={step.next} disabled={revealed >= steps.length}>
              Show next row{revealed < steps.length ? ` (j = ${revealed})` : ""}
            </button>
            <button type="button" onClick={step.all}>Show all</button>
            <button type="button" onClick={step.stop}>Stop step-through</button>
            <span className="hint"> {int(revealed)} of {int(n)} rows shown</span>
          </>
        )}
      </div>

      <p className="hint">Selected rows (j, calculation, row, time, heart rate):</p>
      <ul className="row-list">
        {shown.map((s) => {
          const r = rows[s.row - 1];
          return (
            <li key={s.j}>
              j = {s.j}: {stepCalc(result, s)} → {r.timestamp}, {r.heart_rate_bpm.toFixed(1)} bpm
            </li>
          );
        })}
        {shown.length === 0 && <li className="hint">Press “Show next row”.</li>}
      </ul>
      <p>Estimate = sample mean = the plain average heart rate of the selected minutes.</p>
    </>
  );
}

function StratifiedRule({ N, n, seed, result, columnName, colors }) {
  if (!result.ok) {
    return (
      <p className="error">
        Stratified sampling by {columnName} needs n ≥ {result.H} (at least one row per stratum). No stratified sample is
        drawn for n = {int(n)}. Choose n ≥ {result.H}, or another method.
      </p>
    );
  }
  const totals = result.strata.reduce(
    (t, s) => ({ N_h: t.N_h + s.N_h, n_h: t.n_h + s.n_h, w: t.w + s.weight }),
    { N_h: 0, n_h: 0, w: 0 },
  );
  return (
    <>
      <p>
        <strong>Rule:</strong> split all {int(N)} rows into strata by <strong>{columnName}</strong>. Allocate the{" "}
        {int(n)} rows in proportion to stratum size (proportional allocation, largest-remainder rounding, at least 1
        row per stratum and never more than the stratum has). Within each stratum, take a simple random sample without
        replacement (seed {seed}).
      </p>
      <table className="alloc">
        <thead>
          <tr>
            <th>Stratum</th>
            <th>Rows in population N<sub>h</sub></th>
            <th>Weight N<sub>h</sub>/N</th>
            <th>Exact share n·N<sub>h</sub>/N</th>
            <th>Rows sampled n<sub>h</sub></th>
            <th>Stratum sample mean (bpm)</th>
            <th>Weight × mean</th>
          </tr>
        </thead>
        <tbody>
          {result.strata.map((s, h) => (
            <tr key={s.label}>
              <td>
                <span className="dot" style={{ borderColor: colors[h] }} /> {s.label}
              </td>
              <td>{int(s.N_h)}</td>
              <td>{s.weight.toFixed(4)}</td>
              <td>{s.quota.toFixed(2)}</td>
              <td>{int(s.n_h)}</td>
              <td>{s.mean.toFixed(2)}</td>
              <td>{s.contribution.toFixed(2)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td>{int(totals.N_h)}</td>
            <td>{totals.w.toFixed(4)}</td>
            <td>{int(n)}</td>
            <td>{int(totals.n_h)}</td>
            <td></td>
            <td>{result.estimate.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Estimate = <strong>population-weighted mean</strong> = Σ (N<sub>h</sub>/N) × (stratum sample mean) ={" "}
        {result.estimate.toFixed(2)} bpm. Each stratum counts by its share of the population, not by how many rows were
        sampled from it.
      </p>
    </>
  );
}

export default function RulePanel(props) {
  const { method } = props;
  return (
    <section className="rule-panel">
      <h2>How the rows were selected</h2>
      {method === "srs" && <SrsRule {...props} />}
      {method === "systematic" && <SystematicRule {...props} />}
      {method === "stratified" && <StratifiedRule {...props} />}
    </section>
  );
}
