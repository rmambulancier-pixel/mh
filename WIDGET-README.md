# MesHeures V18.0.23 — Widget V7.1

Widget Android natif, miroir du moteur MesHeures côté WebView.

## Affichage
- mois et progression
- Travail / Repos / Congé / Maladie
- TTE jour / mois / semaine / quatorzaine
- HS 25 % / HS 50 %
- brut et net estimé/réel lorsqu'exposé par MesHeures
- marge avant 46 h et nombre d'alertes
- solde RC
- prochaine journée réellement planifiée

## Actions
- Appui sur le widget : ouvre MesHeures sur l'accueil.
- `+` : ouvre directement la saisie du jour.

## Architecture
Le widget Android ne recalcule ni TTE, ni heures supplémentaires, ni paie, ni règles légales. Il lit uniquement le payload JSON produit par MesHeures et conservé en SharedPreferences.

## V7.1 — compatibilité RemoteViews
La zone basse a été volontairement simplifiée pour éviter les attributs XML non nécessaires et les poids fractionnaires. Le contenu reste identique fonctionnellement.

## Version
- Application : V18.0.23
- versionCode : 1823
- Widget : V7.1
- Cible : Pixel 10 Pro XL / Pixel Launcher
