# MesHeures V18.1.0 — Widget V8 stable

Widget Android natif conçu pour Pixel Launcher / Pixel 10 Pro XL.

## Correctif V8
- Remplacement de la RemoteView précédente par une hiérarchie volontairement conservatrice : LinearLayout + TextView + ImageView uniquement.
- Suppression du ProgressBar XML et des opérations de tint dynamiques qui pouvaient faire échouer l'inflation RemoteViews sur certains hôtes.
- Taille par défaut portée à 4 cellules verticales afin que tout le contenu soit réellement affiché.
- Le widget affiche toujours une vue de secours même si aucun payload n'est encore disponible.
- Le calcul reste 100 % côté MesHeures ; Android ne recalcule ni paie ni règles légales.

## Affichage
- mois / progression
- travail / repos / congé / maladie
- TTE jour / mois / semaine / quatorzaine
- HS25 / HS50
- brut / net estimé ou réel
- marge 46 h / alertes
- solde RC
- prochaine journée planifiée

## Actions
- Appui sur le widget : Accueil MesHeures.
- `+` : saisie du jour.

## Version
- Application : V18.1.0
- Android versionCode : 1830
- Widget : V8 stable
- Cible testée conceptuellement : Pixel 10 Pro XL / Pixel Launcher
