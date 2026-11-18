// Chart.js defaults for the dark neon theme (display only).
import { Chart, Tooltip } from "chart.js";

// The tooltip defaults only exist once the Tooltip plugin is registered, so register it first.
Chart.register(Tooltip);

Chart.defaults.color = "#8fb4c4";
Chart.defaults.borderColor = "rgba(0, 229, 255, 0.14)";
Chart.defaults.font.family = '"Exo 2", system-ui, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(4, 10, 20, 0.95)";
Chart.defaults.plugins.tooltip.borderColor = "#00e5ff";
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = "#d8f6ff";
Chart.defaults.plugins.tooltip.bodyColor = "#d8f6ff";
