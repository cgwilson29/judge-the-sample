// Default settings when the app opens.
export const DEFAULTS = { method: "srs", n: 100, seed: 20261118, strataColumn: "activity_state" };

export const METHOD_NAMES = {
  srs: "Simple random",
  systematic: "Systematic (random start)",
  stratified: "Stratified",
};

// Okabe–Ito colours (colour-blind safe; its dark blue swapped for white on the dark theme), used to outline sampled points by stratum.
export const STRATUM_COLORS = ["#E69F00", "#56B4E9", "#009E73", "#CC79A7", "#ffffff", "#D55E00", "#F0E442"];
