// Colour-blind-safe sequential scale (viridis), used to colour each minute by its heart rate.
export const VIRIDIS = [
  "#440154", "#482878", "#3e4989", "#31688e", "#26828e",
  "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725",
];

const RGB = VIRIDIS.map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));

// Maps a value in [lo, hi] to an rgba colour string.
export function colorFor(value, lo, hi, alpha = 1) {
  const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo || 1)));
  const pos = t * (RGB.length - 1);
  const i = Math.min(RGB.length - 2, Math.floor(pos));
  const f = pos - i;
  const c = RGB[i].map((a, k) => Math.round(a + (RGB[i + 1][k] - a) * f));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

export const VIRIDIS_GRADIENT = `linear-gradient(to right, ${VIRIDIS.join(", ")})`;
