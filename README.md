# MesHeures V18.1.0 — Android + PWA

> **Version actuelle : V18.1.0 — Android versionCode 1830**

## V18.1.0 — Widget Android V3 intégré

Cette version part du socle V18.1.0 audité et ajoute le widget Android sans réintroduire les anciennes couches/fichiers fantômes.

### Widget
- Widget Android natif `MesHeures` pour le Pixel 10 Pro XL et les launchers Android récents.
- Affiche le TTE du jour, le TTE de la semaine, le TTE de la quatorzaine, le net estimé de la période courante et la marge avant 46 h.
- Pastille d'état verte / orange / rouge selon la marge 46 h.
- Nombre d'alertes du mois affiché dans le statut.
- Appui sur le widget : ouvre MesHeures.
- Bouton `+` : ouvre directement la saisie du jour.
- Le widget ne contient **aucun moteur de calcul** : il affiche uniquement le dernier résumé poussé par le WebView.
- Le cache du widget est conservé par Android dans `SharedPreferences`, donc le dernier état reste visible même lorsque l'application n'est pas ouverte.
- Thème du widget adapté automatiquement au mode clair/sombre Android via `values/` et `values-night/`.

### Source unique du net estimé
`mhCurrentPaySummary()` expose la formule déjà utilisée par la paie. Le widget consomme ce résultat au lieu de recopier une deuxième formule.

### Sauvegarde / export
- Sauvegarde locale automatique conservée.
- Points de restauration conservés.
- Export JSON complet via sélecteur de fichier Android.
- Import JSON avec contrôle et sauvegarde de sécurité avant remplacement.
- Sauvegarde/restauration chiffrée AES-256-GCM avec dérivation PBKDF2-SHA-256.
- Compatibilité conservée avec les anciens points de sauvegarde V17.

### Dossier / rapprochement / intelligence
- Les métriques de journée du dossier, du rapprochement et des plugins passent par `cd()` via `mhCalcDay()`.
- Projection 12 semaines et motifs récurrents conservés.
- Les calculs restent locaux et les données restent dans le stockage de l'application.

### Android / Pixel 10 Pro XL
- `compileSdk 35`, `targetSdk 35`, `minSdk 26`.
- Java 17 / Gradle 8.9 / AGP 8.7.3.
- Edge-to-edge et barres système gérés par l'activité.
- `singleTop` utilisé pour les deep-links du widget.
- Permissions widget minimales : aucune nouvelle permission sensible.

## Intégrité du dépôt
- Un seul fichier `app-pwa.js` pour la persistance et la synchronisation widget.
- Un seul `app-pay.js` pour le calcul de paie et l'exposition du résumé net.
- Aucun ancien `legal-v16.2.4.js`, `pay-fix-v16.2.js`, `style.css` ou `app-v17.js` actif dans le socle final.
- Les noms `mhV17*` qui subsistent dans le code sont uniquement des **namespaces de compatibilité de données/API historiques** et ne désignent pas des fichiers V17 actifs.
- Les documents de tests historiques restent présents uniquement comme documentation ; ils ne sont pas chargés par l'application.

## Données
Aucune suppression volontaire de données : journées, paramètres, périodes, bulletins, ROMI, constats, événements et rapprochements sont conservés lors des migrations et imports compatibles.

## Build signé
Le workflow GitHub Actions utilise la clé de signature persistante du projet via les secrets :
- `MESHEURES_KEYSTORE_B64`
- `MESHEURES_KEY_PASSWORD`
- `MESHEURES_STORE_PASSWORD`
- `MESHEURES_KEY_ALIAS`

Le keystore n'est jamais inclus dans le dépôt.

## Contrôles de cette release
- Syntaxe JavaScript vérifiée avec `node --check`.
- XML Android vérifiés comme XML bien formés.
- Manifest et fichiers JSON vérifiés.
- Références des scripts vérifiées par rapport aux fichiers réellement présents.
- Version runtime synchronisée en `18.1.0` / `versionCode 1830`.
- Compilation Android finale à effectuer par le workflow GitHub Actions du dépôt ; aucun SDK Android local n’est supposé disponible dans ce kit.


## V18.1.0 — Widget V5
Correction de la synchronisation du widget : le payload de paie est produit directement par le moteur MesHeures, synchronisé avec retries, puis écrit/rafraîchi de façon atomique côté Android.


## V18.1.0 — Widget V8
Le widget conserve le V6 validé et ajoute en bas : **solde RC** + **prochaine journée planifiée**. Aucun nouveau moteur de calcul n'est introduit.
