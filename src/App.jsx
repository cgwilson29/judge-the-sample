import { useMemo, useState } from "react";
import { population, gaps } from "./data.js";
import { TARGET } from "./population.js";
import { mulberry32, trueMean, srsIndices, sampleMean } from "./sampling.js";
import { TEMP_SAMPLE } from "./config.js";
import { VIRIDIS_GRADIENT } from "./colorScale.js";
import Timeline from "./Timeline.jsx";

const fmt = (x) => x.toFixed(2);

export default function App() {
  const [axisMode, setAxisMode] = useState("time");

  const values = useMemo(() => population.map((r) => r[TARGET]), []);
  const N = values.length;
  const mu = useMemo(() => trueMean(values), [values]);
  const sampleIdx = useMemo(
    () => srsIndices(N, TEMP_SAMPLE.n, mulberry32(TEMP_SAMPLE.seed)),
    [N],
  );
  const xbar = useMemo(() => sampleMean(values, sampleIdx), [values, sampleIdx]);
  const bpmRange = useMemo(() => [Math.min(...values), Math.max(...values)], [values]);
  const missingMinutes = gaps.reduce((s, g) => s + g.missing, 0);
  const longestStep = Math.max(0, ...gaps.map((g) => g.toMinute - g.fromMinute));
  const longestMissing = Math.max(0, ...gaps.map((g) => g.missing));
  const diff = xbar - mu;

  return (
    <main>
      <h1>Judge the Sample: wearable heart rate</h1>
      <p className="lead">
        Population: all <strong>{N.toLocaleString("en-US")}</strong> recorded minutes in{" "}
        <code>data/heart_rate_week.csv</code> — one wearer's week, 25 April – 1 May 2016. Each point is
        one recorded minute; its colour shows that minute's heart rate.
      </p>

      <p className="banner">
        <strong>Temporary sample for testing the display only.</strong> {TEMP_SAMPLE.method}, n ={" "}
        {TEMP_SAMPLE.n}, seed {TEMP_SAMPLE.seed}. The sampling methods and their settings arrive in the
        next stage.
      </p>

      <table className="readout">
        <tbody>
          <tr>
            <th>True population mean (all {N.toLocaleString("en-US")} minutes)</th>
            <td>{fmt(mu)} bpm</td>
          </tr>
          <tr>
            <th>Sample mean — this single temporary sample (n = {TEMP_SAMPLE.n}, seed {TEMP_SAMPLE.seed})</th>
            <td>{fmt(xbar)} bpm</td>
          </tr>
          <tr>
            <th>Sample mean − true population mean</th>
            <td>
              {diff >= 0 ? "+" : "−"}
              {fmt(Math.abs(diff))} bpm
            </td>
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
          Row order (gaps marked by dashed lines between rows)
        </label>
      </fieldset>

      <Timeline
        rows={population}
        sampleIndices={sampleIdx}
        gaps={gaps}
        axisMode={axisMode}
        trueMean={mu}
        sampleMean={xbar}
        bpmRange={bpmRange}
      />

      <div className="legend">
        <span className="key">
          <span className="swatch-bar" style={{ background: VIRIDIS_GRADIENT }} />
          {bpmRange[0].toFixed(1)} → {bpmRange[1].toFixed(1)} bpm (point colour)
        </span>
        <span className="key"><span className="swatch-sampled" /> Sampled minute (outlined)</span>
        <span className="key"><span className="swatch-line true" /> True population mean</span>
        <span className="key"><span className="swatch-line sample" /> Sample mean (temporary sample)</span>
        <span className="key">
          <span className="swatch-gap" /> Missing minutes (no reading)
        </span>
      </div>

      <p className="note">
        <strong>Row order:</strong> rows are in time order, but minutes with no reading are absent, so row
        number is not time. {missingMinutes} of the week's {(7 * 1440).toLocaleString("en-US")} minutes
        have no reading, in {gaps.length} gaps; the longest gap is {longestStep} minutes between two
        consecutive readings ({longestMissing} minutes with no reading). In real-time view, short
        gaps are drawn at least 2 pixels wide so they remain visible.
      </p>
    </main>
  );
}
