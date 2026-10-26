# Model Report 5 — Tree ensembles (gradient boosting + random forest), 2026-10-25

Two more model families on the EXACT Model 2 / Model Report 4 protocol
(fit and isotonic functions imported from train_ensemble.py, prior from
AM-scored train rows only, same 80/20 seed-11 train split, isotonic
fitted on the train holdout only), so the only thing that changes is the
model family. Same features as the adopted model:

  M2+R   [am_score, gene_prior, revel_score]  logistic (Report 4)
  GBM+R  [am_score, gene_prior, revel_score]  gradient boosting
  RF+R   [am_score, gene_prior, revel_score]  random forest

Scored subsets only (missense SNVs with both precomputed scores):
train 138,133 / test 10,357. Fit on 110,506 train rows; the 27,627-row
train holdout is used for isotonic fitting only, never for fitting the
model and never for evaluation. Test = post-2024 reclassifications only.

Library: scikit-learn 1.9.1 (GradientBoostingClassifier,
RandomForestClassifier) — the Week-2 dependency already named in
requirements.txt. It is not installed in this machine's system Python,
so the run used a project virtualenv; the training script is
scripts/train_trees.py and its console output is kept in
data/processed_v2/train_trees.log. Tree models consume the raw
features (no standardisation — trees are scale-invariant); the logistic
anchor uses fit_logreg's standardisation as before.

Hyperparameters (fixed before the run, not tuned on test):
  GBM: n_estimators=300, learning_rate=0.06, max_depth=3,
       subsample=0.8, random_state=11
  RF:  n_estimators=500, min_samples_leaf=5, random_state=11

## Anchor check

Re-running the Report 4 logistic under this protocol first, before any
tree number counts, reproduces Model Report 4 exactly:
raw AUROC 0.969 ECE 0.260 Brier 0.171 | +isotonic AUROC 0.968 ECE 0.023
Brier 0.066. Same subset, same split, same prior — the comparison below
is apples-to-apples.

## Test results (variants reclassified AFTER the 2024 freeze)

| model | n_test | AUROC | ECE (iso) | Brier (iso) |
|-------|--------|-------|-----------|-------------|
| AlphaMissense alone | 10,373 | 0.921 | 0.040 | 0.113 |
| AlphaMissense + Platt (fit on 2024) | 10,373 | 0.921 | 0.157 | 0.141 |
| Ensemble (AM + gene prior) raw | 10,373 | 0.959 | 0.251 | 0.176 |
| Ensemble + isotonic (train holdout) | 10,373 | 0.958 | 0.017 | 0.078 |
| M2+R [AM, prior, REVEL] + isotonic (Report 4) | 10,357 | 0.968 | 0.023 | 0.066 |
| GBM+R + isotonic | 10,357 | 0.970 | 0.025 | 0.062 |
| RF+R + isotonic | 10,357 | 0.970 | 0.024 | 0.063 |

Raw (pre-calibration) lines for the new models, same test set:
  GBM+R raw: AUROC 0.972 ECE 0.023 Brier 0.061
  RF+R  raw: AUROC 0.972 ECE 0.022 Brier 0.062

Per-variant predictions: data/processed_v2/test_predictions_trees.csv
(prob_gbm_raw, prob_gbm_isotonic, prob_rf_raw, prob_rf_isotonic).

## Isotonic-calibrated ECE by gene — the Report 4 fifteen (test, n>=50)

| gene | n | M2+R (Report 4) | GBM+R | RF+R |
|------|---|-----------------|-------|------|
| BRCA2 | 158 | 0.041 | 0.058 | 0.054 |
| BRCA1 | 138 | 0.082 | 0.081 | 0.057 |
| ADGRV1 | 130 | 0.016 | 0.005 | 0.007 |
| DNAH11 | 118 | 0.054 | 0.031 | 0.033 |
| DMD | 97 | 0.069 | 0.053 | 0.048 |
| KMT2D | 94 | 0.069 | 0.034 | 0.031 |
| RAI1 | 94 | 0.028 | 0.011 | 0.016 |
| ABCA4 | 86 | 0.023 | 0.019 | 0.017 |
| MUTYH | 86 | 0.083 | 0.154 | 0.136 |
| SCN1A | 83 | 0.046 | 0.074 | 0.070 |
| NF1 | 81 | 0.117 | 0.130 | 0.103 |
| LDLR | 74 | 0.059 | 0.033 | 0.034 |
| USH2A | 74 | 0.290 | 0.204 | 0.203 |
| GCK | 71 | 0.030 | 0.035 | 0.032 |
| FBN1 | 68 | 0.042 | 0.037 | 0.036 |

## Reading this honestly

The trees edge out the logistic on ranking and overall score — AUROC
0.970 vs 0.968, Brier 0.062–0.063 vs 0.066 — at essentially unchanged
calibration (ECE 0.024–0.025 vs 0.023). The margins are small (two
thousandths of AUROC on 10,357 variants) and no significance test is
claimed. Two honest complications:

1. Isotonic did not help the trees. Both were already well calibrated
   raw (ECE 0.022–0.023, Brier at or below their isotonic values); the
   holdout-fitted isotonic step nudged ECE and Brier slightly UP for
   both. The protocol was applied unchanged anyway — a calibration
   step that is only applied when it flatters the result would not be
   a protocol.
2. Per gene, the trees fix the worst logistic failure only partly
   (USH2A 0.290 -> ~0.20, still the worst gene in the table) and they
   break a gene the logistic had right (MUTYH 0.083 -> 0.136–0.154).
   The aggregate win is not a uniform win.

This report is an ablation addition, in the open. The README headline
table is unchanged and M2+R remains the model behind the published
agent reports (examples/agent_reports_real.md and the page lookup are
generated from it); whether to adopt a tree model as the headline is
the project owner's call, not this report's.
