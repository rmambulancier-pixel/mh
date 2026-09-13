# MesHeures V18.0.16 — Widget Android

Widget natif ajouté au socle V18.0.16. Il affiche uniquement un cache JSON produit par le WebView.

## V18.0.16 — Widget V2

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
