# V18.0.11 — Bulletin ↔ période / synthèse

## Correction
La carte « Synthèse professionnelle » ne déduit plus l'état « À renseigner » du champ RC de la quatorzaine.

Elle recherche les bulletins importés dont le mois correspond à au moins un jour de la période affichée. Une quatorzaine chevauchant deux mois peut donc reconnaître un ou deux bulletins mensuels.

## Comportement attendu
- Bulletin 2026-08 importé + période couvrant août → affichage du bulletin (mois, brut, net), et non « À renseigner ».
- Période sans bulletin correspondant → « Aucun bulletin pour cette période ».
- Plusieurs mois couverts + plusieurs bulletins → affichage de tous les bulletins correspondants.
- Aucun changement des données `DB.days`, `DB.bulletins` ou du moteur `cd()` / `calcPer()` / `brutOf()`.

## Contrôles statiques
- `node --check` : OK sur les JS modifiés.
- Version Android : 18.0.11 / versionCode 1811.
- Service Worker et manifest synchronisés.
