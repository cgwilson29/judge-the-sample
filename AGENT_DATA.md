# AI use record (agent's account)

This file is the coding agent's own factual record of its work on this project, to support section 6
("AI use") of `DECISIONS.md`. It does not replace that section, which the student writes. Where this
file describes what the student checked, it lists only what the agent could see in the session. The
student should confirm or correct those items.

## 1. Agent, model and settings

| Item | Value |
|---|---|
| Agent | Claude Code (Anthropic), running in the VS Code extension |
| Model | Claude Opus 5.5 (model ID `claude-opus-5-5`) |
| Reasoning effort | Medium |
| Modes used | Plan mode for every design discussion (stages 2–5 and the theme); implementation mode for building |
| Session date | 18 November 2026 (one session) |
| Instructions followed | `AGENT_BRIEF.md`, plus the student's own prompts at each stage |

## 2. Ground rules the agent followed

Following `AGENT_BRIEF.md`:

- **Did not write or edit `DECISIONS.md`.** The agent read section 5 once, read-only, because the stage-5
  prompt contained a placeholder instead of the hypothesis. It used that text exactly as written.
- **Did not calculate or report the population's true mean to the student in stage 1.** The app displays
  the true mean, labelled, because the brief requires it. The automated checks never print it.
- **Did not propose a hypothesis, population change, ordering or expected outcome for stage 5.** It did not
  suggest that any method should fail.
- **Did not run the stage-4 experiments or the stage-5 challenge for the student, and did not report,
  rank or interpret their results.** Automated checks ran the sampling code only to test correctness, and
  printed pass/fail only.
- **Built only the designs the student chose,** and asked before changing them.

One exception for transparency: while troubleshooting the deployed site (section 5 below), the agent took
screenshots of the app to check that it rendered. The default single-sample readout, including the
labelled true mean, was visible in them. The agent did not report or discuss any values.

## 3. What the agent was asked to do, and what it did

| Stage | What the student asked | What the agent did | Commit |
|---|---|---|---|
| 0 | Read the brief, summarise the project and data, explain and prepare the setup | Unpacked the starter; verified the CSV's SHA-256 and that it loads; created `package.json`; installed React 19.3.1, Vite 8.3.8 and @vitejs/plugin-react 6.3.0 at exact versions; wrote `run_app.sh` | `add7840`, `85cf473` |
| 2 | Brainstorm three visualizations; build the chosen one with a temporary SRS of 100 | Presented three designs. Built the student's choice: a week timeline, heat-coloured points, shaded missing-minute gaps, and a real-time/row-order toggle (Chart.js 4.6.1). Temporary labelled SRS (seed 20261118); shared module `src/sampling.js` | `27956a9` |
| 3 | Propose interaction approaches; implement SRS, systematic and stratified | Built the student's choice: one method at a time, a rule panel with live numbers, a systematic step-through, and strata chosen by the user (activity state, day, 6-hour band). Shows a message (no sample) when n is smaller than the number of strata | `4b882d6` |
| 4 | Propose presentations; implement Experiments A and B | Built the student's choice: dot strips, a table with bias / SD / RMSE / MC s.e., repetitions 100–1,000, seeded streams, exact enumeration for whole-number systematic intervals, and reuse of A's SRS n = 100 result in B | `e4b14de` |
| 5 | Propose ways to apply the student's own hypothesis; implement the chosen one | Built the student's choice: a Challenge section with a seeded row-shuffle copy, a return-to-baseline button, four labelled results at the same n, each judged against its own population's true mean, plus a time-period coverage table | `90cf45d` |
| Theme | Polish the look and music, and host on GitHub Pages | An original neon-grid theme (no TRON names, logos, lettering or soundtrack, which are copyrighted), a three.js 0.187.0 background, an original Web Audio synth loop, and a GitHub Actions deploy workflow | `65176bc` |
| Fixes | Troubleshoot the blank deployed page, tone down the glow, then the missing audio | Found and fixed a startup crash and an audio-unlock bug, both introduced by the agent (section 5) | `ab4379b`; audio fix in the next commit |

The student also committed evidence screenshots (`4684a2d`, and within `90cf45d`). The agent committed
them on request without opening them.

## 4. What the student did and checked

Visible to the agent during the session. **Student to confirm or correct:**

- **Chose every design in Plan mode:**
  - stage 2: the timeline with heat-coloured points, gap shading and the axis toggle;
  - stage 3: approach A with the step-through, columns the user can choose, and "explain, no sample";
  - stage 4: dot strips with the MC standard error, in sections below the single-sample view;
  - stage 5: the challenge section, a full shuffle, stratified by time-of-day band, and the coverage table;
  - the theme: cyan/orange, a three.js background, an original synth, and GitHub Actions.
- **Wrote `DECISIONS.md` entries** (the file changed between stages); the agent did not edit it.
- **Wrote and dated the stage-5 hypothesis (11-18-2026) before asking the agent about it.**
- **Ran the app locally and on the live site,** and ran the experiments and the challenge themselves. The
  evidence screenshots in `evidence/` are the student's.
- **Found the blank deployed page** and asked for troubleshooting.
- **Found that no audio was playing** on the deployed site.
- *Student to add:* checks made in the running app (for example the reproducibility of seeds, the
  systematic design labels, allocation totals, and the labels on each result), and how the evidence numbers
  were read and recorded.

## 5. Problems found, and how they were resolved

| Problem | Found by | Cause | Resolution |
|---|---|---|---|
| A gap-length check failed (134 vs 135) | Agent's automated check (stage 2) | Two definitions: minutes with no reading (134) vs time between consecutive readings (135, as documented) | The check and the app's note now state both |
| Deployed page blank | Student | The agent's `chartTheme.js` set tooltip defaults before Chart.js's Tooltip plugin was registered, so the app threw at startup | Register the plugin first; confirmed in headless Chromium (`ab4379b`) |
| Background glow too bright | Agent, from a screenshot | Large horizon sprite and strong bloom | Dimmer, lower glow and softer bloom (`ab4379b`) |
| No audio on the deployed site | Student | The agent's music code requested audio before any user gesture and then reused that stuck request on the click. Touch `pointerdown` was also not treated as a gesture | Audio is started inside the click, tap or key handler on every attempt; confirmed in headless Chromium (pending deploy at time of writing) |
| `npm audit` reports 5 "high" advisories | npm at install | One `picomatch` advisory in Vite's build tooling (development only, not shipped to the browser) | Left as is; the offered fix would downgrade Vite to version 6 |

## 6. Automated checks the agent reported

All checks are in `tests/sampling.test.js` and run with `npm test`; the deploy workflow also runs them before
every deployment. They report pass/fail only and never print investigation results.

| Stage | Checks | Result reported |
|---|---|---|
| 2 | 15 | 14/15 on first run (gap-definition mismatch), then **15/15** |
| 3 | 25 | **25/25** |
| 4 | 35 | **35/35** |
| 5 | 44 | **44/44** (still 44/44 after the theme and both fixes) |

**What they cover:**

- **Data:** all 9,864 rows load in order; `heart_rate_bpm` is numeric; timestamps increase; the missing
  minutes (216) and longest gap (135) match the documentation; each strata column partitions all rows;
  the `activity_state` sizes match the data dictionary.
- **Random numbers and reproducibility:** the same seed gives the same sequence, and the same seed and
  settings give the same rows, estimates and summaries for every method and for the challenge.
- **Simple random sampling:** exactly n distinct rows at n = 1, 10, 100, 7 (which doesn't divide N) and N;
  invalid n rejected; all subsets equally likely on a small population.
- **Systematic sampling:**
  - exactly n distinct rows within 1…N for every n from 1 to 9,864;
  - the whole-number design is used exactly when N/n is a whole number (rows r, r + k, …);
  - fractional rows equal ceil(u + j·k), with no row past N even at the largest start;
  - inclusion probability n/N, both exactly (all starts listed once) and by Monte Carlo.
- **Stratified sampling:**
  - allocations are whole numbers totalling n, between 1 and the stratum size, for every column and every n;
  - weights sum to 1; known-answer allocations; "n smaller than the number of strata" draws no sample;
  - the population-weighted estimator gives the known answer (17.5, not the plain mean of 25);
  - each sample has n distinct rows, each inside its own stratum.
- **Repeated sampling:**
  - the number of estimates equals the repetition count (100 and 1,000);
  - each repetition is n distinct rows and its estimate is that sample's estimator;
  - Experiment B's n = 100 result equals Experiment A's; repetition counts outside 100–1,000 are rejected;
  - exact enumeration lists each of k starts once;
  - bias, SD, RMSE and MC s.e. match hand calculations; RMSE² = bias² + SD²; a constant population gives zero error.
- **Challenge:**
  - the data file's SHA-256 is unchanged (also after building a copy and running the challenge);
  - the shuffled copy is a true permutation, reproducible from its seed, and leaves the original untouched;
  - the modified true mean equals the mean of the modified rows and is unchanged by reordering;
  - the systematic design is re-checked for each population's N, and counts the copy's row order;
  - all four results use the same n, with correct labels; baseline results equal Experiment A's.

**Other technical checks the agent ran and reported (not part of `npm test`):**

- `npm run build` succeeded at every stage.
- The production build was served under `/judge-the-sample/` and every asset returned HTTP 200.
- The GitHub Actions deploy runs succeeded, and the live URL served the built app.
- Headless Chromium rendered the page: the console error was found, then a clean render with all
  11 section headings after the fix.
- An audio test in headless Chromium, under the normal "sound only after a user gesture" rule: the old
  code stayed suspended after a click; the fixed code runs after one click, mute stops new notes, and
  unmute resumes them.

## 7. Third-party material

| Item | Source and licence |
|---|---|
| Data | `data/heart_rate_week.csv`: Furberg et al., Crowd-sourced Fitbit datasets, Zenodo (doi:10.5281/zenodo.53894), CC BY 4.0 (see `data/README.md`) |
| Libraries | React, Vite, Chart.js and three.js: MIT licence, at exact versions in `package.json` |
| Fonts | Orbitron and Exo 2, from Google Fonts (SIL Open Font License) |
| Music and visuals | Written for this app by the agent; no audio files, no third-party artwork, and no TRON assets |
