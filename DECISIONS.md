# My decisions and evidence notes

Written by me, not by my AI agent. Write my challenge hypothesis (section 5) **before** consulting
my agent about it, and do not edit it afterwards; add a dated revision below instead.

| Stage | What I record here |
|---|---|
| 1 | Section 1 |
| 2–5 | Section 2: my design choice, written before I switch my agent to build |
| 4 | Section 3: method and sample-size rows; section 4: findings (a) and (b) |
| 5 | Section 5: hypothesis first; then section 3: challenge rows; section 5: finding (c) |
| All | Section 6: AI use |

## 1. Population and target

- Scenario and file: Wearable Heart Rate, data/heart_rate_week.csv
- One row means: One recorded minute
- Number of rows (N): 9864
- Row order, and what it means in this file: Chronological, the time-ordered date-hour-minute for one week (April 25 - May 1, 2016), and blank minutes are omitted form the datset
- Target column and units: 'heart_rate_bpm' in beats per minute
- My finite population is (and what it is not): a single week's measured heart rates over 1 minute intervals for this wearer; it is not a comprehensive dataset of all minutes (some are omitted) nor other wearers.
- True mean I calculated (and how): mean heart_rate_bpm is 66.41105 bpm, as calulated by Excel formula '=average(C2:C9865)'

## 2. Design choices

For each stage: the option I chose, why, and what it is meant to help a user learn.

- Stage 2, visualization (include one visual feature meant to reveal a sampling problem): I chose to use a timeline of the week (Design 1) in combination with a week heatmap, allowing a sampling problem to be identified with empty stretches and heatmap color visually. This was selected for ease of reading and understanding the data, in an effort to help the user learn that this data has missing values (identified by the heatmap) and does not equate rows with timestamps.
- Stage 3, sampling interactions and stratification column: I chose to utilize a single method selector with rule panel alongside a step-through (show next row) for systematic sampling. This allows a user to understand each method without overcluttering the display, providing detailed explanations of their selections as the user proceeds, by understanding how each method samples/stratifies the data.
- Stage 4, presentation of the method comparison and sample-size experiments: I chose to present this section as dot strips on a shared axis (with one row per condition) to visualize every visible estimate and allow direct comparison of rows between each experiement. The user take away should be how methods and sample sizes affect proximity to the true mean and how realiable the estimates are.
- Stage 5, challenge controls and my alternative method or correction: I chose to challenge the systematic sampling given the baseline chronological order of the dataset, where the hypothesis is that chronological row ordering may produce biased estimates of the data mean because heart rate fluctuates according to time of day, activity, sleep, and other recurring patterns. This is meant to teach a user that at times systematic sampling can affect the outputs and may not serve as the best option for chronologically ordered data.

## 3. Results table

One row per result I read from my app. Add rows as needed. Rerun and update a row whenever I
like: my app does not need to keep a history of runs. Seed is "exact" for exact enumeration;
type is Monte Carlo or exact. In Settings I record the settings that matter for the result, such
as the stratification column and allocation, or my challenge-control values. True mean is the
true mean of the population that result was drawn from (the modified copy's own recalculated
value for modified rows). Keep each result in its own row: never pool estimates.

| Experiment | Population or condition | Method | Settings | Seed (or exact) | n | Repetitions or starts | Type | True mean | Bias | SD | RMSE |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Methods at n = 100 | baseline | Simple random | 	Without replacement| 20261118| 100 | 100 repetitions| Monte Carlo| 66.41| +0.15| 1.84| 1.85|
| Methods at n = 100 | baseline | Systematic | Fractional interval, k = 98.64, new random start each repetition, file row order| 20261118| 100 | 100 repetitions| Monte Carlo| 66.41| −0.05| 1.33| 1.33|
| Methods at n = 100 | baseline | Stratified | By Activity state (activity_state column); proportional allocation (largest remainder, ≥1 per stratum): sleep 30, rest 60, exercise 10| 20261118| 100 | 100 repetitions| Monte Carlo| 66.41| −0.02| 1.13| 1.13|
| Sample size | baseline | Simple random | Without replacement| 20261118| 1 | 100 repetitions| Monte Carlo| 66.41| −0.80| 17.02| 17.03|
| Sample size | baseline | Simple random | Without replacement| 20261118| 10 | 100 repetitions| Monte Carlo| 66.41| +0.85| 6.24| 6.30|
| Challenge | baseline (all 9,864 minutes, original row order) | Systematic | Fractional interval, k = 98.64, new random start each repetition, file row order| 556228151| 100| 100 repetitions| Monte Carlo| 66.41| +0.00| 1.60| 1.60|
| Challenge | modified (rows shuffled (shuffle seed 120729805), 9,864 minutes) | Systematic | Fractional interval, k = 98.64, new random start each repetition, file row order| 556228151| 100| 100 repetitions| Monte Carlo| 66.41| −0.14| 1.73| 1.74|
| Challenge | baseline (all 9,864 minutes, original row order) | Stratified (time-of-day band) | By Time-of-day band, 6 hours each (from timestamp); proportional allocation (largest remainder, ≥1 per stratum): Night 00:00–05:59 25, Morning 06:00–11:59 25, Afternoon 12:00–17:59 25, Evening 18:00–23:59 25| 556228151| 100| 100 repetitions| Monte Carlo| 66.41| +0.11| 1.58| 1.59|
| Challenge | modified (rows shuffled (shuffle seed 120729805), 9,864 minutes) | Stratified (time-of-day band) | By Time-of-day band, 6 hours each (from timestamp); proportional allocation (largest remainder, ≥1 per stratum): Night 00:00–05:59 25, Morning 06:00–11:59 25, Afternoon 12:00–17:59 25, Evening 18:00–23:59 25| 556228151| 100| 100 repetitions| Monte Carlo| 66.41| −0.12| 2.01	| 2.01	|

The simple random n = 100 row is also the n = 100 sample-size result when the population and
settings match. If I reran it with different settings, I add a separate row. All four challenge
rows use the same n; a challenge baseline row may repeat a matching stage 4 result.

## 4. Findings (in my own words, using my own numbers)

- (a) Method comparison: the three sampling methods compared at n = 100 (bias versus variability, and for which population): 
  - The three sampling methods at n=100 showed similarities between systematic and stratified sampling, where systematic had a bias of -0.05 and variability of 1.33 as compared to stratified sampling bias of -0.02 and variability of 1.13. Simple random sampling without replacement had a +0.15 bias, and 1.84 variability, showing higher variability/spread and bias towards higher heart rate mean as compared to the true mean. Thus, for simple random sampling method a typical estimate is off by about 1.85 beats per minute, with systematic estimates off by about 1.33 bpm, and stratified estiamtes off by about 1.13bpm.
- (b) Sample-size finding: how sample size affects the spread of estimates and the estimation error, and what a larger sample cannot fix:
  - Increasing the sample size reduces the variability/standard deviation of estimates and trends towards the true mean, as shown by n=1 SD 17.02, n=10 SD 6.24, and n=100 SD 1.84. As the SD narrows, the variation in estimates becomes much smaller and approaches the true mean. This is also exemplified by the RMSE of each, accounting for bias and SD, where RMSE decreases (respectively) and states that the typical size of the error of a single estimate gets smaller as sample size increases. A larger sample size however cannot fix underlying measurement error or other biases liek selection or systematic bias.

## 5. Challenge (hypothesis written independently, before consulting my agent)

Hypothesis, written before I consult my agent:

- Date written: 11-18-2026
- Method I chose to challenge: Systematic Sampling
- The change to the population or its ordering: Adjusting the order of rows to avoid chronologic interpretation
- Why the selection rule would interact with that change: Shuffling row order prevents the selection rule from potentially choosing a block of similar time periods (numerous 'afternoons' or 1300s, etc).
- Evidence I expect across repeated samples: For systematic sampling, I expect  the samples to more widely vary across time points (morning, afternoon, evening, night) instead of potentially sampling the same time periods
- Alternative method or correction I will compare, and why:stratified sampling method comparison ensures representation across all time periods, accounting for any temporal relation to heart rate
- Evidence that would contradict my hypothesis: Shuffling rows has no impact on time period selection

After I test it:

- Test settings (conditions, methods, alternative method or correction, n, seeds); results are in the table above:
- (c) Challenge interpretation: did the evidence support my hypothesis? Bias versus variability, other explanations, what the alternative or correction showed, and any dated revision (keep the original above):
  - The evidence did *not* support my hypothesis. Row shuffling had a marginally worse estimation of means in the Stratified sampling (modified) run, as evidenced by a bias of -0.14 (compared with baseline 0), and variation/SD of 1.73 (versus 1.6 baseline), suggesting that the baseline stratified sampling with random start did not reflect any significant impact by time of day selection. The time-period coverage chart additionally shows that distribution of night, morning, afternoon, and evening composition was nearly 25% for each band in each method. The alternative method of Stratified sampling additionally did not support the hypothesis, showing similar trends in the modified versus baseline data with worse variation/SD and RMSE.

## 6. AI use

- Tools used: Claude Opus 5.5 (Medium), an AGENT_DATA.md file was created to outline this section.
- What I asked my agent to do, and what I checked myself: Following the prompts verbatim as supplied in the Judge The Sameple github pages directions and starter zip files. I verified all checks as described on the same pages.
- -Automated checks my agent reported (I did not let it interpret my results): My agent reported all automated checks as passed.
