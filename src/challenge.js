// Stage 5: the four challenge results (pure function, used by Challenge.jsx and the tests).
// Systematic and stratified sampling, each on the baseline and on the modified copy, at the same n,
// each measured against the true mean of the population it was drawn from.
import { TARGET, groupRows, groupIndexOf } from "./population.js";
import { repeatedSampling } from "./sampling.js";

export function runChallenge({ baseRows, modRows, shuffleSeed, n, reps, seed, strataKey }) {
  const pops = [
    { label: "baseline", rows: baseRows, population: "" },
    { label: "modified", rows: modRows, population: `modified:shuffle=${shuffleSeed}` },
  ];
  const conditions = [];
  for (const method of ["systematic", "stratified"]) {
    for (const p of pops) {
      const values = p.rows.map((r) => r[TARGET]);
      const result = repeatedSampling({
        method,
        values,
        n,
        reps,
        seed,
        population: p.population,
        strata: method === "stratified" ? groupRows(p.rows, strataKey) : undefined,
        strataKey: method === "stratified" ? strataKey : "",
        coverageGroups: groupIndexOf(p.rows, strataKey),
      });
      conditions.push({ method, populationLabel: p.label, result });
    }
  }
  return conditions;
}
