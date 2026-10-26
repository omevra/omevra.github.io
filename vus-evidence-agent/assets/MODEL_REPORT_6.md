# Model Report 6 — Final-model head-to-head and adoption of GBM+R, 2026-10-26

The founder's call: maximum accuracy, settled by measurement. Every
candidate already implemented in this repo was re-run head-to-head on
the SAME frozen temporal test (train frozen 2024-01; test = variants
reclassified after the freeze), same features, same split, same
calibration protocol as Model Reports 2/4/5: gene prior computed from
AlphaMissense-scored FROZEN TRAIN rows only (smoothed m=10), 80/20
seed-11 train shuffle, isotonic fitted on the train holdout only,
metrics from src/vus_agent/calibrate.py. Nothing was fitted on test;
no feature changed. Script: scripts/eval_headtohead_20261026.py;
raw output: data/processed_v2/headtohead_20261026.log and
headtohead_20261026.json; per-variant predictions:
headtohead_20261026_predictions.csv. The fresh run reproduces the
earlier reports exactly (anchors A and B match Model Reports 2 and 4;
the GBM probabilities are bit-identical to Model Report 5's).

## Head-to-head (isotonic-calibrated, post-freeze test)

| model | n_test | AUROC | ECE | Brier |
|-------|--------|-------|-----|-------|
| AlphaMissense alone (reference) | 10,373 | 0.921 | 0.040 | 0.113 |
| A — logistic [AM, gene prior] (Model 2; the model the live app actually served) | 10,373 | 0.958 | 0.017 | 0.078 |
| E — WithoutMLP (Report 3, metrics recomputed from its saved predictions) | 10,373 | 0.947 | 0.013 | 0.090 |
| B — logistic [AM, prior, REVEL] (M2+R, Model Report 4) | 10,357 | 0.968 | 0.023 | 0.066 |
| D — random forest + REVEL (Report 5) | 10,357 | 0.970 | 0.024 | 0.063 |
| C — gradient boosting + REVEL (GBM+R, Report 5) | 10,357 | 0.970 | 0.025 | 0.062 |

Exact values: GBM+R AUROC 0.9705 / ECE 0.0248 / Brier 0.0625;
RF+R 0.9696 / 0.0235 / 0.0635; M2+R 0.9676 / 0.0226 / 0.0659;
Model 2 0.9577 / 0.0169 / 0.0775.

## Decision

Decision rule, fixed before the run: highest isotonic AUROC wins;
ties broken by Brier, then ECE. **GBM+R wins and is adopted** — best
AUROC (0.9705) and best Brier (0.0625) of the field; RF+R is a close
second and slightly better calibrated (ECE 0.0235 vs 0.0248). Against
the model the app actually served (Model 2 logistic), GBM+R gains
+0.013 AUROC and −0.015 Brier at worse headline ECE (0.025 vs 0.017 —
Model 2 stays the best-calibrated row in the table; the trade is
stated, not hidden). Against the previously published M2+R: +0.003
AUROC, −0.003 Brier, +0.002 ECE.

Per gene (GBM+R isotonic ECE, n≥50), the aggregate win is not uniform,
exactly as Report 5 warned: USH2A improves 0.290 → 0.204 (still the
worst of the fifteen published genes), MUTYH degrades 0.083 → 0.154,
NF1 0.117 → 0.130. Two published under-confident calls are resolved
(HOGA1 c.289C>T 0.493 → 0.808; GLB1 c.601C>T 0.493 → 0.979); PROC
c.629C>T remains under-confident at 0.464, and RANBP2 c.1754C>T
remains a confident miss (0.002 → 0.006, later reclassified
Pathogenic/Likely pathogenic).

## What changed in the live app — and what did not

Deployed 2026-10-26 (Space Evidra/variant-evidence-agent, full-manifest
commit b947565f). The `prob_ensemble` column the app serves now carries
GBM+R isotonic probabilities; model version string is now
"v3 gradient boosting (GBM+R)". Published metrics on the app surface
(header chips, Validation tab, README, per-gene table in app/tools.py)
now read AUROC 0.970 / ECE 0.025 / Brier 0.062, measured on the
post-freeze temporal test set (scored subset n=10,357).

The cite-or-decline rule did NOT change: same MIN_EVIDENCE = 3, same
evidence items, same threshold. Summarised/declined counts shifted
only because GBM+R requires a REVEL score in addition to
AlphaMissense: 16 test variants carry an AlphaMissense score but no
REVEL score, so they no longer receive a model probability and are
declined like every other unscored variant:

  before: 10,373 summarised / 17,375 declined (of 27,748)
  after:  10,357 summarised / 17,391 declined (of 27,748)

All six shipped app test suites pass after re-pinning the served-model
values (CFTR c.1373G>T 0.996 → 0.999; counts; BRCA2 published ECE
0.041 → 0.058; version string). Live verification: /api/meta reports
the new counts and model version; CFTR c.1373G>T returns 0.999; the
known decline CFTR c.1209+18A>C still declines.

## Not yet updated

The public showcase (netlify-site / GitHub Pages) still presents
M2+R as the final model: its generator (build_site.py) draws the
"final" reliability series from test_predictions_revel.csv and checks
itself against docs/validation-dossier.md. Updating it means pointing
that series at the GBM predictions, adding a dossier addendum, and
rebuilding — flagged for the showcase owner rather than half-edited
here, so the showcase never shows a headline its own charts contradict.
