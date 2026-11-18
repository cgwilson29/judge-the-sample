// Parsing the population CSV (pure functions: usable in the browser and in Node tests).
// The supplied CSV has no quoted fields, so a plain split on commas is enough.

export const TARGET = "heart_rate_bpm";
export const EXPECTED_COLUMNS = ["row_id", "timestamp", "heart_rate_bpm", "n_readings", "activity_state"];

// Week start used for the time axis: 2016-04-25 00:00 (device local time).
const WEEK_START_UTC = Date.UTC(2016, 3, 25, 0, 0);

// "YYYY-MM-DD HH:MM" -> minutes since 2016-04-25 00:00.
// Date.UTC is used only as a calendar calculator, so no time-zone or daylight-saving shift applies.
export function timestampToMinute(ts) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(ts);
  if (!m) throw new Error(`Unexpected timestamp format: "${ts}"`);
  const [, y, mo, d, h, mi] = m.map(Number);
  return (Date.UTC(y, mo - 1, d, h, mi) - WEEK_START_UTC) / 60000;
}

// Returns one object per CSV row, in file order, with numeric fields parsed as numbers.
export function parsePopulation(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split(",");
  if (cols.join(",") !== EXPECTED_COLUMNS.join(",")) {
    throw new Error(`Unexpected columns: ${cols.join(", ")}`);
  }
  return lines.map((line, i) => {
    const v = line.split(",");
    const row = {
      row_id: Number(v[0]),
      timestamp: v[1],
      minute: timestampToMinute(v[1]),
      heart_rate_bpm: Number(v[2]),
      n_readings: Number(v[3]),
      activity_state: v[4],
    };
    if (!Number.isFinite(row.heart_rate_bpm)) {
      throw new Error(`Row ${i + 1}: ${TARGET} is not a number ("${v[2]}")`);
    }
    return row;
  });
}

// ---------- Strata (observable group columns) ----------

export const DAY_LABELS = ["Mon 25 Apr", "Tue 26 Apr", "Wed 27 Apr", "Thu 28 Apr", "Fri 29 Apr", "Sat 30 Apr", "Sun 1 May"];
export const BAND_LABELS = ["Night 00:00–05:59", "Morning 06:00–11:59", "Afternoon 12:00–17:59", "Evening 18:00–23:59"];

// Each column: a key, a display name, its levels in display order, and how to read a row's level.
// Day and time-of-day band are derived from the timestamp only.
export const STRATA_COLUMNS = [
  { key: "activity_state", name: "Activity state (activity_state column)", levels: ["sleep", "rest", "exercise"], of: (r) => r.activity_state },
  { key: "day", name: "Day of the week (from timestamp)", levels: DAY_LABELS, of: (r) => DAY_LABELS[Math.floor(r.minute / 1440)] },
  { key: "band", name: "Time-of-day band, 6 hours each (from timestamp)", levels: BAND_LABELS, of: (r) => BAND_LABELS[Math.floor((r.minute % 1440) / 360)] },
];

// Splits the rows into strata [{ label, indices }] (0-based row indices), in the column's level order.
// Levels with no rows are left out.
export function groupRows(rows, columnKey) {
  const col = STRATA_COLUMNS.find((c) => c.key === columnKey);
  if (!col) throw new Error(`unknown stratification column "${columnKey}"`);
  const byLevel = new Map(col.levels.map((l) => [l, []]));
  rows.forEach((r, i) => {
    const level = col.of(r);
    if (!byLevel.has(level)) throw new Error(`row ${r.row_id}: unexpected ${columnKey} value "${level}"`);
    byLevel.get(level).push(i);
  });
  return col.levels.filter((l) => byLevel.get(l).length > 0).map((l) => ({ label: l, indices: byLevel.get(l) }));
}

// ---------- Modified copy (stage 5) ----------

// A labelled MODIFIED COPY with the row order randomly shuffled (seeded Fisher–Yates permutation of all
// rows). Each row keeps its own values (heart rate, timestamp, activity state); only the order changes.
// New row objects are returned: `row_id` is the new position (1..N) and `orig_row_id` the original row.
// The input array and the file on disk are never changed. `rng` is a seeded generator from sampling.js.
export function shuffledCopy(rows, rng) {
  const order = rows.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((src, pos) => ({ ...rows[src], row_id: pos + 1, orig_row_id: rows[src].row_id }));
}

// Group index per row for a stratification column (e.g. time-of-day band), in the column's level order.
export function groupIndexOf(rows, columnKey) {
  const col = STRATA_COLUMNS.find((c) => c.key === columnKey);
  if (!col) throw new Error(`unknown column "${columnKey}"`);
  return { levels: col.levels, index: rows.map((r) => col.levels.indexOf(col.of(r))) };
}

// Gaps: places where consecutive rows are more than one minute apart.
// `afterIndex` is the 0-based index of the row just before the gap; `missing` is the number of
// minutes with no reading between the two rows.
export function findGaps(rows) {
  const gaps = [];
  for (let i = 1; i < rows.length; i++) {
    const diff = rows[i].minute - rows[i - 1].minute;
    if (diff > 1) {
      gaps.push({
        afterIndex: i - 1,
        fromMinute: rows[i - 1].minute,
        toMinute: rows[i].minute,
        missing: diff - 1,
      });
    }
  }
  return gaps;
}
