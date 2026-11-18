import { useEffect, useRef } from "react";
import { Chart, ScatterController, PointElement, LinearScale, Tooltip } from "chart.js";
import { colorFor } from "./colorScale.js";

Chart.register(ScatterController, PointElement, LinearScale, Tooltip);

const DAY_LABELS = ["Mon 25 Apr", "Tue 26 Apr", "Wed 27 Apr", "Thu 28 Apr", "Fri 29 Apr", "Sat 30 Apr", "Sun 1 May"];
const MINUTES_IN_WEEK = 7 * 1440;
const MIN_GAP_PX = 2; // short gaps are drawn at least this wide so they stay visible

// Draws the gap bands/markers behind the points and the two labelled mean lines on top.
const overlayPlugin = {
  id: "gapsAndMeans",
  beforeDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea: area, scales } = chart;
    const x = scales.x;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
    ctx.clip();
    for (const g of opts.gaps) {
      if (opts.axisMode === "time") {
        // Missing minutes run from fromMinute+1 to toMinute-1; band covers them.
        let x0 = x.getPixelForValue(g.fromMinute + 0.5);
        let x1 = x.getPixelForValue(g.toMinute - 0.5);
        if (x1 - x0 < MIN_GAP_PX) {
          const mid = (x0 + x1) / 2;
          x0 = mid - MIN_GAP_PX / 2;
          x1 = mid + MIN_GAP_PX / 2;
        }
        ctx.fillStyle = "rgba(220, 38, 38, 0.18)";
        ctx.fillRect(x0, area.top, x1 - x0, area.bottom - area.top);
      } else {
        // Row order: a thin dashed line between the two rows on either side of the gap.
        const px = x.getPixelForValue(opts.rowIds[g.afterIndex] + 0.5);
        ctx.strokeStyle = "rgba(220, 38, 38, 0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, area.top);
        ctx.lineTo(px, area.bottom);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
  afterDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea: area, scales } = chart;
    const drawLine = (value, label, dash, color, labelAbove) => {
      const py = scales.y.getPixelForValue(value);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(area.left, py);
      ctx.lineTo(area.right, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "bold 12px system-ui, sans-serif";
      const w = ctx.measureText(label).width;
      const lx = area.right - w - 8;
      const ly = labelAbove ? py - 6 : py + 16;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(lx - 4, ly - 12, w + 8, 16);
      ctx.fillStyle = color;
      ctx.fillText(label, lx, ly);
      ctx.restore();
    };
    // Put the higher line's label above it and the lower line's label below it so they don't overlap.
    const trueAbove = opts.trueMean >= opts.sampleMean;
    drawLine(opts.trueMean, opts.trueLabel, [], "#111", trueAbove);
    drawLine(opts.sampleMean, opts.sampleLabel, [7, 5], "#c2410c", !trueAbove);
  },
};

export default function Timeline({ rows, sampleIndices, gaps, axisMode, trueMean, sampleMean, bpmRange }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const [lo, hi] = bpmRange;
    const xOf = (r) => (axisMode === "time" ? r.minute : r.row_id);
    const sampled = new Set(sampleIndices);
    const point = (r, i) => ({ x: xOf(r), y: r.heart_rate_bpm, i });

    const popData = rows.map(point);
    const sampleData = sampleIndices.map((i) => point(rows[i], i));

    const chart = new Chart(canvasRef.current, {
      type: "scatter",
      data: {
        datasets: [
          // Dataset 0 is drawn on top: the sampled minutes.
          {
            label: "Sampled minutes",
            data: sampleData,
            pointRadius: 4.5,
            pointHoverRadius: 6,
            pointBackgroundColor: sampleData.map((p) => colorFor(p.y, lo, hi)),
            pointBorderColor: "#000",
            pointBorderWidth: 1.5,
          },
          {
            label: "All recorded minutes",
            data: popData,
            pointRadius: 1.6,
            pointHoverRadius: 3,
            pointBorderWidth: 0,
            pointBackgroundColor: popData.map((p) => colorFor(p.y, lo, hi, 0.55)),
          },
        ],
      },
      options: {
        animation: false,
        parsing: false,
        normalized: true,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: "linear",
            min: axisMode === "time" ? 0 : 1,
            max: axisMode === "time" ? MINUTES_IN_WEEK - 1 : rows.length,
            title: {
              display: true,
              text: axisMode === "time" ? "Time in the week (device local time)" : "Row number (file order)",
            },
            ...(axisMode === "time"
              ? {
                  afterBuildTicks: (axis) => {
                    axis.ticks = DAY_LABELS.map((_, d) => ({ value: d * 1440 }));
                  },
                  ticks: { callback: (v) => DAY_LABELS[Math.round(v / 1440)] ?? "" },
                }
              : {}),
          },
          y: { title: { display: true, text: "Heart rate (beats per minute)" } },
        },
        plugins: {
          tooltip: {
            mode: "nearest",
            intersect: true,
            callbacks: {
              title: () => "",
              label: (ctx) => {
                const r = rows[ctx.raw.i];
                return [
                  `Row ${r.row_id} — ${r.timestamp}`,
                  `${r.heart_rate_bpm.toFixed(1)} bpm, ${r.activity_state}`,
                  sampled.has(ctx.raw.i) ? "In the temporary sample" : "Not sampled",
                ];
              },
            },
          },
          gapsAndMeans: {
            axisMode,
            gaps,
            rowIds: rows.map((r) => r.row_id),
            trueMean,
            sampleMean,
            trueLabel: `True population mean: ${trueMean.toFixed(2)} bpm`,
            sampleLabel: `Sample mean (temporary sample): ${sampleMean.toFixed(2)} bpm`,
          },
        },
      },
      plugins: [overlayPlugin],
    });
    return () => chart.destroy();
  }, [rows, sampleIndices, gaps, axisMode, trueMean, sampleMean, bpmRange]);

  return (
    <div className="chart-box">
      <canvas ref={canvasRef} aria-label="Heart rate of every recorded minute in the week, with sampled minutes outlined" role="img" />
    </div>
  );
}
