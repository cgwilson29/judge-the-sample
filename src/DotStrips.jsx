import { useEffect, useRef } from "react";
import { Chart, ScatterController, PointElement, LinearScale, Tooltip } from "chart.js";

Chart.register(ScatterController, PointElement, LinearScale, Tooltip);

const ROW_COLORS = ["#0072B2", "#D55E00", "#009E73", "#CC79A7"];
const ROW_HEIGHT = 80;

// Small, reproducible vertical offset per repetition so dots don't sit exactly on top of each other.
const jitter = (i) => (((i * 0.6180339887) % 1) - 0.5) * 0.5;

// Draws the labelled true-mean line, and for each row the mean of estimates (diamond) and ±1 SD bracket.
const overlayPlugin = {
  id: "stripOverlay",
  afterDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea: area, scales } = chart;
    const { x, y } = scales;
    ctx.save();
    if (opts.perRow) {
      // Each row has its own population: draw that population's true mean across its row only.
      ctx.font = "bold 11px system-ui, sans-serif";
      opts.rows.forEach((r, h) => {
        const tx = x.getPixelForValue(r.trueMean);
        const y0 = y.getPixelForValue(h - 0.45);
        const y1 = y.getPixelForValue(h + 0.45);
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, y0);
        ctx.lineTo(tx, y1);
        ctx.stroke();
        const label = `True mean (${r.populationLabel}): ${r.trueMean.toFixed(2)}`;
        const w = ctx.measureText(label).width;
        const lx = Math.min(Math.max(tx + 4, area.left), area.right - w);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(lx - 2, y0, w + 4, 13);
        ctx.fillStyle = "#111";
        ctx.fillText(label, lx, y0 + 10);
      });
    }
    // True population mean (one shared population)
    if (!opts.perRow) {
    const tx = x.getPixelForValue(opts.trueMean);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, area.top);
    ctx.lineTo(tx, area.bottom);
    ctx.stroke();
    ctx.font = "bold 12px system-ui, sans-serif";
    const label = `True population mean: ${opts.trueMean.toFixed(2)} bpm`;
    const w = ctx.measureText(label).width;
    const lx = Math.min(Math.max(tx - w / 2, area.left), area.right - w);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(lx - 3, area.top - 16, w + 6, 15);
    ctx.fillStyle = "#111";
    ctx.fillText(label, lx, area.top - 4);
    }

    // Per row: ±1 SD bracket and mean-of-estimates diamond
    opts.rows.forEach((r, h) => {
      const py = y.getPixelForValue(h + 0.36); // just below the row's dots (dots span ±0.25)
      const x0 = x.getPixelForValue(r.meanOfEstimates - r.sd);
      const x1 = x.getPixelForValue(r.meanOfEstimates + r.sd);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, py - 5); ctx.lineTo(x0, py); ctx.lineTo(x1, py); ctx.lineTo(x1, py - 5);
      ctx.stroke();
      const mx = x.getPixelForValue(r.meanOfEstimates);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(mx, py - 7); ctx.lineTo(mx + 6, py); ctx.lineTo(mx, py + 7); ctx.lineTo(mx - 6, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  },
};

// rows = [{ name, estimates, meanOfEstimates, sd, trueMean?, populationLabel? }].
// Without perRowTrueMean: all rows come from ONE population with true mean `trueMean` (one shared line).
// With perRowTrueMean: each row is drawn against its own population's true mean (rows[h].trueMean).
export default function DotStrips({ rows, trueMean, ariaLabel, perRowTrueMean = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const chart = new Chart(canvasRef.current, {
      type: "scatter",
      data: {
        datasets: rows.map((r, h) => ({
          label: r.name,
          data: r.estimates.map((e, i) => ({ x: e, y: h + jitter(i), i })),
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBorderWidth: 0,
          pointBackgroundColor: ROW_COLORS[h % ROW_COLORS.length] + "66",
        })),
      },
      options: {
        animation: false,
        parsing: false,
        normalized: true,
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22 } },
        scales: {
          x: { type: "linear", grace: "5%", title: { display: true, text: "Estimate of the mean heart rate (bpm), one dot per repetition" } },
          y: {
            type: "linear",
            reverse: true,
            min: -0.5,
            max: rows.length - 0.5,
            afterBuildTicks: (axis) => {
              axis.ticks = rows.map((_, h) => ({ value: h }));
            },
            ticks: { callback: (v) => rows[v]?.name ?? "" },
            grid: { display: false },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: () => "",
              label: (ctx) => `${rows[ctx.datasetIndex].name}, repetition ${ctx.raw.i + 1}: ${ctx.raw.x.toFixed(2)} bpm`,
            },
          },
          stripOverlay: { rows, trueMean, perRow: perRowTrueMean },
        },
      },
      plugins: [overlayPlugin],
    });
    return () => chart.destroy();
  }, [rows, trueMean, perRowTrueMean]);

  return (
    <div className="strip-box" style={{ height: rows.length * ROW_HEIGHT + 90 }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
}
