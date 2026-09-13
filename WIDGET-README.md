# MesHeures V18.0.15 — Widget Android

Widget natif ajouté au socle V18.0.14. Il affiche uniquement un cache JSON produit par le WebView.

## Données affichées
- TTE du jour
- TTE de la semaine
- TTE de la quatorzaine courante
- Net estimé de la période courante, issu de la même formule que la page Paie
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
