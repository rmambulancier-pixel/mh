
## V15.3
MesHeures V15.3 regroupe le dashboard, le calendrier intelligent, la synthèse paie, l’audit renforcé, le rapprochement bulletin, les statistiques historiques et le centre de sauvegarde/restauration. Le moteur de calcul historique reste inchangé.
# MesHeures — refonte technique

Cette version conserve l'interface et les règles de calcul de la base fournie, mais sépare le JavaScript en responsabilités claires.

- `scripts/app-core.js` : constantes, état applicatif et calculs métier (TTE, quatorzaines, paie).
- `scripts/app-pwa.js` : persistance locale.
- `scripts/app-ui.js` : navigation, édition des journées et rendu de l'interface.
- `scripts/app-parser.js` : imports/analyse bulletins, PDF, Excel et ROMI.
- `scripts/app.js` : orchestration et initialisation.

Les scripts sont chargés dans cet ordre dans `index.html`, avec `defer`, afin de préserver les handlers inline existants.

## Vérification effectuée

- Syntaxe JavaScript validée avec `node --check` sur les 5 fichiers.
- Smoke test du moteur de calcul : TTE, amplitude et calcul de période cohérents sur une journée de test.
- Aucune dépendance supplémentaire n'est requise.

## V16.1 — ALL-IN-ONE PREMIUM
- Identité Pulse conservée comme identité officielle de MesHeures.
- Accueil enrichi : état du jour, prochaine journée, activité récente et état de sauvegarde locale.
- Calendrier : appui long sur une journée avec actions Modifier / Détail / Dupliquer vers / Effacer.
- Paie : nouvelle fiche de paie estimative avec brut, net estimé, HS, nuit, dimanches et ancienneté.
- Audit : score de santé du planning et synthèse des contrôles.
- Bulletin : statut explicite de comparaison calculé ↔ bulletin.
- Sauvegarde : sauvegarde locale automatique quotidienne + restauration automatique, en plus de l'export JSON.
- Extensions : gestionnaire .mhplugin conservé et intégré à l'ensemble V16.
