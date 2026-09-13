# MesHeures V18.0.21 — Widget Android

Widget natif ajouté au socle V18.0.21. Il affiche uniquement un cache JSON produit par le WebView.

## V18.0.21 — Widget V3 : source de vérité paie

Le widget affiche désormais le mois complet, la progression, les statuts, TTE, HS, paie, marge 46 h et alertes. Le net privilégie le bulletin réel du mois lorsqu’il existe, sinon l’estimation de la période courante.

## Données affichées
- TTE du jour
- TTE du mois
- TTE de la semaine
- TTE de la quatorzaine courante
- HS 25 % / HS 50 % de la période courante
- Brut et net (bulletin réel du mois si disponible, sinon estimation)
- Travail / Repos / Congé / Maladie
- Marge avant 46 h / 12 semaines
- Nombre d’alertes du mois
- Date de dernière synchronisation

## Actions
- Appui sur le widget : ouvre MesHeures.
- `+` : ouvre directement la saisie du jour.

## Sécurité et architecture
Le widget Android ne connaît ni `cd()` ni les règles de paie. Il lit seulement `SharedPreferences` alimentées par `MesHeuresAndroid.updateWidgetData()`. Aucun calcul légal n'est dupliqué dans le code Java du widget.

## Pixel 10 Pro XL
Le widget utilise un format moyen 4×2, redimensionnable horizontalement et verticalement. Les couleurs sont définies séparément pour le thème clair et le thème sombre Android.

## Limite de test
Le code a été contrôlé statiquement et les scripts JavaScript passent `node --check`. La compilation Android finale est exécutée par GitHub Actions avec le SDK Android du runner.


### Correctif V3
- Le résumé brut/net est maintenant exposé par `app-core.js`, après `calcPer()` et `brutOf()`, avant le chargement des couches secondaires.
- `app-pwa.js` consomme cette source unique ; Android n'effectue aucun calcul de paie.
- Le bulletin réel du mois courant reste prioritaire lorsqu'il existe ; sinon le widget affiche l'estimation de la période de paie active.
- Le widget est repoussé au démarrage une fois toutes les couches V18 chargées, afin d'éviter un cache incomplet.
- Les données du widget restent un miroir du moteur MesHeures : pas de recalcul AmbuTrack.


## V18.0.21 — Widget V4
- Paie calculée exclusivement par `calcPer()` + `brutOf()` côté WebView.
- Le bulletin du mois courant prime uniquement lorsqu'il contient un brut/net réel.
- Synchronisation avec retries au démarrage/retour au premier plan.
- Le bridge Android persiste le payload puis rafraîchit directement tous les widgets.
- Aucun calcul de paie, TTE ou règle légale dans Android.
- Validation sur le jeu de données de sauvegarde du 13/09/2026 : période 24/08→06/09 = 122h05, HS25 16h00, HS50 26h35, brut 2 620,39 €, net estimé 2 129,33 €.
