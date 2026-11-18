import { METHOD_NAMES } from "./config.js";
import { STRATA_COLUMNS } from "./population.js";
import { MAX_SEED } from "./sampling.js";

export default function Controls({ N, method, setMethod, nInput, setNInput, nError, seedInput, setSeedInput, seedError, strataColumn, setStrataColumn }) {
  const newSeed = () => setSeedInput(String(Math.floor(Math.random() * 1e9)));
  return (
    <div className="controls">
      <fieldset>
        <legend>Sampling method</legend>
        {Object.entries(METHOD_NAMES).map(([key, name]) => (
          <label key={key}>
            <input type="radio" name="method" value={key} checked={method === key} onChange={() => setMethod(key)} /> {name}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Sample size n (rows in one sample)</legend>
        <input
          type="number"
          min="1"
          max={N}
          step="1"
          value={nInput}
          onChange={(e) => setNInput(e.target.value)}
          aria-label="Sample size n"
        />
        {[1, 10, 100].map((v) => (
          <button key={v} type="button" onClick={() => setNInput(String(v))}>
            n = {v}
          </button>
        ))}
        <div className="hint">Any whole number from 1 to {N.toLocaleString("en-US")}.</div>
        {nError && <div className="error">{nError}</div>}
      </fieldset>

      <fieldset>
        <legend>Seed (makes the random choice reproducible)</legend>
        <input
          type="number"
          min="0"
          max={MAX_SEED}
          step="1"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          aria-label="Seed"
        />
        <button type="button" onClick={newSeed}>New seed</button>
        <div className="hint">The same seed and settings always give the same sample.</div>
        {seedError && <div className="error">{seedError}</div>}
      </fieldset>

      {method === "stratified" && (
        <fieldset>
          <legend>Stratify by</legend>
          <select value={strataColumn} onChange={(e) => setStrataColumn(e.target.value)} aria-label="Stratification column">
            {STRATA_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
        </fieldset>
      )}
    </div>
  );
}
