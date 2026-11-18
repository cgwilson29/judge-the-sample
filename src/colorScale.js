// Colour-blind-safe sequential scale used to colour each minute by its heart rate: viridis from 25% to
// 100% (its darkest quarter is left out so the lowest heart rates stay visible on the dark background).
export const VIRIDIS = [
  "#3b528b", "#2c728e", "#21918c", "#28ae80", "#5ec962", "#addc30", "#fde725",
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
