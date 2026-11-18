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
