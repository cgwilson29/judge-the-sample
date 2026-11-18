// Loads the student's CSV (unchanged, from data/) into the browser at build time.
import csvText from "../data/heart_rate_week.csv?raw";
import { parsePopulation, findGaps } from "./population.js";

export const population = parsePopulation(csvText);
export const gaps = findGaps(population);
