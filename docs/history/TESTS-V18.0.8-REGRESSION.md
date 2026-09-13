# MesHeures V18.0.8 — Regression / data-integrity checks

## Critical data path
- Raw `DB.days` records remain untouched.
- All derived day metrics used by V18 legal/probative features come from `cd(k)` through `mhCalcDay(k)`.
- Dossier dates come from `Object.entries(DB.days)` keys, not `d.k`.
- Dossier TTE/amplitude/pause/alerts come from computed metrics.
- Reconciliation month TTE/anomalies come from computed metrics.
- Reconciliation quatorzaine allocation uses computed TTE.
- Statistics plugin uses `r.al.length` (not nonexistent `r.alerts`).

## Preservation
- No active JS feature was removed.
- The active `scripts/pay-fix-v16.2.js` remains present and loaded.
- No legacy legal file is activated.

## Version
- PWA / Android / Service Worker / UI: 18.0.8
- Android versionCode: 1808

## Audit correction
- Every legal/probative consumer of day metrics is forbidden from reading derived fields from raw `DB.days`.
- The canonical path is `mhCalcDay(k)` -> `cd(k)`.
- Raw records are only the source inputs and are never mutated by the adapter.
- Dossier summary/table, reconciliation TTE/anomalies, and Statistics plugin were specifically checked against this invariant.
