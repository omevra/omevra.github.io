# Validation dossier — vus-evidence-agent

**This is a research system, not a certified medical product. Clinical
deployment would require formal validation and regulatory clearance.**
Nothing in this dossier changes the project's stated scope:

> Not for clinical use. Research / portfolio project only. (README)

This dossier assembles, in one place, the validation evidence the project
already carries in its own reports — the split report, the feature report,
the model reports, the leakage audit, and the agent's published outputs.
Every number below is taken from those files; file names are given so any
claim can be traced to its source.

## 1. Intended use

Evidence summarisation for variant interpretation research — a reviewer
aid. The system takes a variant of uncertain significance, retrieves the
records that bear on it from sources frozen at a declared cutoff, and
returns either a cited evidence summary with a calibrated probability, or
an explicit refusal. Its own verdict line states the boundary:

> "evidence summary (not a clinical classification)"
> (`src/vus_agent/agent.py`, `examples/agent_reports_real.md`)

The README states the same boundary from the human side: "A calibrated
probability is not a clinical classification. ACMG classification remains
a human, guideline-driven judgement."

## 2. Validation design

A temporal split, built from dated ClinVar releases — never a random
split (`data/processed_v2/SPLIT_REPORT.md`,
`docs/leakage-audit.md`):

- Cutoff snapshot rows (GRCh38): **2,366,650**; current snapshot rows:
  **4,578,190**.
- **Train** (labelled at the 2024-01 cutoff, frozen): **1,103,657**
  variants (pathogenic 240,752 / benign 862,905).
- **Test** (uncertain at the cutoff → reclassified by now): **27,748**
  variants (pathogenic 8,856 / benign 18,892). No test label existed at
  train time.
- **Near-duplicate guard:** test rows sharing gene+name with train are
  removed; the guard removed **0** rows in this build. The leakage audit
  states the design rule behind it: "same variant / same codon across
  splits goes to train only."
- **Why:** random ClinVar splits leak — a variant reclassified using
  predictor scores reappears, with those scores as features, in both
  train and test, so the model is graded on evidence it has already seen.
- **Caveat, stated in the split report itself:** "post-cutoff
  reclassifications are themselves partly predictor-influenced." The
  temporal split removes the direct leak; it does not make labels pure.

## 3. Performance

Full ablation, on the post-freeze test set only (README, "Results";
underlying detail in `data/processed_v2/MODEL_REPORT*.md`). Lower ECE and
Brier are better; higher AUROC is better.

| Model | AUROC | ECE | Brier |
|---|---|---|---|
| AlphaMissense alone | 0.921 | 0.040 | 0.113 |
| AlphaMissense + Platt (fit on 2024) | 0.921 | 0.157 | 0.141 |
| Ensemble (AM + gene prior) raw | 0.959 | 0.251 | 0.176 |
| Ensemble + isotonic (fit on train holdout) | 0.958 | 0.017 | 0.078 |
| Ensemble + REVEL + isotonic (Model Report 4) | **0.968** | **0.023** | **0.066** |

The middle rows are reported, not hidden: adding the gene prior lifted
AUROC to 0.959 while raw calibration collapsed (ECE 0.251), and Platt
calibration fitted on the training window made probabilities *worse*
(ECE 0.040 → 0.157) at unchanged AUROC.

REVEL ablation (`MODEL_REPORT_4.md`). Coverage on the test set (n =
27,748): REVEL 39.7% | AlphaMissense 37.4% | either 39.8%.

| model | n_test | AUROC | ECE (iso) | Brier (iso) |
|---|---|---|---|---|
| M2 [AM, prior] | 10,373 | 0.958 | 0.017 | 0.078 |
| R+prior [REVEL, prior] | 11,023 | 0.952 | 0.019 | 0.081 |
| M2+R [AM, prior, REVEL] | 10,357 | **0.968** | 0.023 | 0.066 |

### Per-gene calibration (M2+R, isotonic ECE, genes with n ≥ 50)

From `MODEL_REPORT_4.md`. Calibration is reported per gene because the
aggregate figure hides badly miscalibrated subgroups. The worst genes
are listed, not trimmed:

| Gene | n | ECE |
|---|---|---|
| ADGRV1 | 130 | 0.016 |
| ABCA4 | 86 | 0.023 |
| RAI1 | 94 | 0.028 |
| GCK | 71 | 0.030 |
| BRCA2 | 158 | 0.041 |
| FBN1 | 68 | 0.042 |
| SCN1A | 83 | 0.046 |
| DNAH11 | 118 | 0.054 |
| LDLR | 74 | 0.059 |
| DMD | 97 | 0.069 |
| KMT2D | 94 | 0.069 |
| BRCA1 | 138 | 0.082 |
| MUTYH | 86 | 0.083 |
| NF1 | 81 | 0.117 |
| **USH2A** | **74** | **0.290** |

USH2A, at ECE 0.290, is a calibration failure by the project's own
standard and is carried visibly in the report. The earlier ensemble's
per-gene results (README) showed the same pattern — ECE 0.020–0.128 for
most genes, with NF1 (0.231) and USH2A (0.278) as the honest failures.

## 4. Failure modes and honest misses

Published by the project itself in `examples/agent_reports_real.md`:

- **A confident call the future disagreed with.** RANBP2
  c.1754C>T (p.Thr585Met) received a cited summary at calibrated
  P(pathogenic) **0.002** — confidently benign-leaning. Its later
  reclassification was Pathogenic/Likely pathogenic.
- **Under-confident calls on variants later classed pathogenic.**
  HOGA1 c.289C>T, PROC c.629C>T and GLB1 c.601C>T each received
  P(pathogenic) **0.493**; all three were later reclassified
  Pathogenic/Likely pathogenic.
- **Predictor-influenced labels.** The evaluation labels themselves are
  partly predictor-influenced (split report caveat; README "Honest
  limits"). Measured performance is therefore performance against
  real-world reclassification practice, not against predictor-free
  ground truth.
- **Coverage limits.** AlphaMissense covers **37.4%** of the test set
  (label=0: 30.0%; label=1: 53.2%) and **12.6%** of train
  (`FEATURE_REPORT.md`). It is missense-only and precomputed-only —
  weights are not released, so no novel-variant scoring exists beyond
  the precomputed predictions. The agent summarises **10,373 of
  27,748** test variants (37.4%) and declines the rest. Scores are
  linked from source, not redistributed (licence ambiguity documented
  in `docs/licence-notes.md`).
- **A method trap, documented in `MODEL_REPORT_4.md`.** Building the
  gene prior from *all* frozen-train rows instead of only AM-scored
  rows silently drops AUROC to 0.933–0.935 (Brier 0.101): the prior
  must describe the scored population the model actually serves.
- **No gnomAD allele frequency.** The light allele-number file is
  locus-level AN only and cannot yield AF (`docs/gnomad-note.md`); the
  model ships without AF rather than with a fabricated one.

## 5. Human oversight design

The oversight rules are enforced in code, not in a prompt
(`src/vus_agent/agent.py`):

- **Cite, or decline. Never invent.** "every claim in a report must
  carry a citation to a retrieved record, and `render()` refuses to
  emit an uncited claim."
- **Minimum-evidence rule.** `MIN_EVIDENCE = 3` distinct evidence items
  are required before the agent says anything at all. Below that, the
  verdict is fixed: **"insufficient evidence — remains VUS."**
- **Reports are evidence summaries, not classifications.** Every
  non-declined report carries the verdict line "evidence summary (not
  a clinical classification)", and the calibrated probability is
  labelled as what it is — ACMG classification remains a human,
  guideline-driven judgement (README).
- **Adversarial refusal test.** `tests/test_agent_refuses.py` checks
  that a fabricated citation or a missing record forces a decline —
  the agent must refuse rather than invent.
- **Declines are a designed output, not an error.** 17,375 of 27,748
  test variants are declined; the published examples show declines
  resting on a single conflicting ClinVar record with no predictor
  score, where the system stays silent instead of building a story.

## 6. Reproducibility

Fully public data, runs on CPU (README). Headline numbers reproduce
with (`examples/DEMO.md` §3):

```bash
python3 scripts/build_temporal_split.py
python3 scripts/join_alphamissense.py
python3 scripts/train_ensemble.py      # Model Report 2: AUROC 0.958, ECE 0.017
python3 scripts/join_revel.py          # (REVEL v1.3, public Zenodo)
python3 scripts/train_revel_ablation.py  # Model Report 4: AUROC 0.968
PYTHONPATH=src python3 scripts/run_agent_real.py
```

The 10-second demo and the refusal test need no downloads:

```bash
PYTHONPATH=src python3 -m vus_agent.demo
PYTHONPATH=src python3 tests/test_agent_refuses.py
```

A Dockerfile is provided (`python:3.12-slim`; installs
`requirements.txt`; runs the demo). Inputs are pinned: ClinVar releases
are dated snapshots (the temporal split depends on it), and the REVEL
v1.3 file was MD5-verified against its public Zenodo record
(`MODEL_REPORT_4.md`). AlphaMissense scores are linked, not
redistributed, per `docs/licence-notes.md`.

## 7. Addendum — 2026-10-26: adoption of GBM+R as the final model (Model Report 6)

**This addendum supersedes, by label, the final-model statements above:**
§3's "Ensemble + REVEL + isotonic (Model Report 4)" row as the final
model, §3's per-gene table (M2+R), and the summarised/declined counts in
§4 and §5. Everything above remains in place as the labelled history it
is — the same way the live app's Validation tab keeps M2+R as labelled
history. The full record is `data/processed_v2/MODEL_REPORT_6.md`;
raw outputs are `data/processed_v2/headtohead_20261026.json` and
`data/processed_v2/headtohead_20261026_predictions.csv` (script:
`scripts/eval_headtohead_20261026.py`).

Every candidate already implemented in the project was re-run
head-to-head on the SAME frozen temporal test — same split, same
features, same calibration protocol as Model Reports 2/4/5 (gene prior
from AlphaMissense-scored frozen-train rows only, smoothed m=10;
80/20 seed-11 train shuffle; isotonic fitted on the train holdout
only; nothing fitted on test).

### Head-to-head (isotonic-calibrated, post-freeze test)

| Model | n_test | AUROC | ECE | Brier |
|---|---|---|---|---|
| AlphaMissense alone (reference) | 10,373 | 0.921 | 0.040 | 0.113 |
| Model 2 — logistic [AM, gene prior] (the model the live app previously served) | 10,373 | 0.9577 | 0.0169 | 0.0775 |
| WithoutMLP (Model Report 3, recomputed from its saved predictions) | 10,373 | 0.947 | 0.013 | 0.090 |
| M2+R — logistic [AM, prior, REVEL] (Model Report 4) | 10,357 | 0.9676 | 0.0226 | 0.0659 |
| RF+R — random forest + REVEL (Model Report 5) | 10,357 | 0.9696 | 0.0235 | 0.0635 |
| GBM+R — gradient boosting [AM, prior, REVEL] + isotonic (Model Report 5; adopted 2026-10-26) | 10,357 | 0.9705 | 0.0248 | 0.0625 |

**Decision rule, fixed before the run:** highest isotonic AUROC wins;
ties broken by Brier, then ECE. **GBM+R wins and is adopted** — best
AUROC (0.9705) and best Brier (0.0625) of the field; RF+R is a close
second. The served model version is now "v3 gradient boosting
(GBM+R)".

**The ECE trade-off, stated plainly.** GBM+R ranks best (AUROC) and
scores best (Brier), but its headline ECE of 0.025 is *worse* than the
previously served Model 2's 0.017 — Model 2 stays the best-calibrated
row in the table. Against M2+R the trade is +0.003 AUROC and −0.003
Brier at +0.002 ECE. The adoption takes the ranking and scoring gains
with the calibration cost on the record, not hidden.

### Per-gene calibration (GBM+R, isotonic ECE, genes with n ≥ 50)

From `headtohead_20261026.json` (`winner_gene_ece_n50`), recomputed
from `headtohead_20261026_predictions.csv` prob_C. The aggregate win
is not uniform: **USH2A improves 0.290 → 0.204** (still the worst
gene), **MUTYH degrades 0.083 → 0.154**, and **NF1 moves 0.117 →
0.130**.

| Gene | n | ECE |
|---|---|---|
| USH2A | 74 | 0.204 |
| MUTYH | 86 | 0.154 |
| MECP2 | 61 | 0.143 |
| TSC2 | 65 | 0.139 |
| MTOR | 62 | 0.134 |
| NF1 | 81 | 0.130 |
| MSH2 | 52 | 0.086 |
| BRCA1 | 138 | 0.081 |
| TP53 | 68 | 0.077 |
| DYSF | 53 | 0.075 |
| SCN1A | 83 | 0.074 |
| BRCA2 | 158 | 0.058 |
| DMD | 97 | 0.053 |
| ATM | 55 | 0.042 |
| NOTCH1 | 50 | 0.041 |
| FBN1 | 68 | 0.037 |
| GCK | 71 | 0.035 |
| KMT2D | 94 | 0.034 |
| LDLR | 74 | 0.033 |
| DNAH11 | 118 | 0.031 |
| ABCA4 | 86 | 0.019 |
| RAI1 | 94 | 0.011 |
| SON | 51 | 0.009 |
| ADGRV1 | 130 | 0.005 |

**Published calls under GBM+R (§4 updated).** Two of §4's
under-confident calls are resolved: HOGA1 c.289C>T moves 0.493 →
0.808 and GLB1 c.601C>T moves 0.493 → 0.979 (both later reclassified
Pathogenic/Likely pathogenic). PROC c.629C>T remains under-confident
at 0.464. RANBP2 c.1754C>T remains a confident miss (0.002 → 0.006;
later reclassified Pathogenic/Likely pathogenic).

### Counts (§4/§5 updated)

The cite-or-decline rule did NOT change — same `MIN_EVIDENCE = 3`,
same evidence items, same threshold. The counts shifted only because
GBM+R requires a REVEL score in addition to AlphaMissense: 16 test
variants carry an AlphaMissense score but no REVEL score, so they no
longer receive a model probability and are declined like every other
unscored variant.

- Before (Model 2 served): **10,373 summarised / 17,375 declined** of 27,748.
- After (GBM+R live, 2026-10-26): **10,357 summarised / 17,391 declined** of 27,748.

Live verification: the app's `/api/meta` reports universe 27,748,
summarised 10,357, declined 17,391, model version "v3 gradient
boosting (GBM+R)".
