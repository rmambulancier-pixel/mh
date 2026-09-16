# Changelog

## V24.2.0 — Navigation (phase 2 de la refonte)
- Suppression d'`app-v22.js` : fichier mort, jamais chargé par `index.html` ni par
  le service worker depuis la V24 (confirmé par recherche exhaustive de
  référence dans le repo).
- `app-v24-analysis.js` posait SON PROPRE gestionnaire de swipe tactile
  (`touchstart`/`touchend` sur `document`) et reconstruisait le nav, en même
  temps qu'`app-v24.js` (chargé juste après) qui fait la même chose avec un
  système plus abouti (`pointerdown`/`pointermove`/`pointerup`, suivi du doigt
  à l'écran). Sur un vrai geste tactile, Chromium délivre touch ET pointer
  events pour le même doigt : les deux systèmes se déclenchaient donc en
  même temps sur chaque swipe. Retiré le doublon dans `app-v24-analysis.js` ;
  la page Analyse elle-même (tendances, chronologie, repères) est inchangée.
- Effet de bord découvert au passage : les deux modules créaient un élément
  `#mhV24Dots` avec des classes CSS différentes ; celui d'`app-v24-analysis.js`
  gagnait la course de création, donc le style prévu par `app-v24.js` pour les
  points de pagination n'était jamais appliqué. Corrigé du même coup.
- Vérifié : `qa/golden-master.js` toujours strictement identique (paie
  inchangée) ; les 19 scripts restants passent `node --check` sans erreur ;
  aucune référence morte entre `index.html`/`sw.js` et les fichiers réels.
- Pas de test sur téléphone réel possible depuis cet environnement (pas de
  SDK Android, pas de rendu WebView) : à confirmer par toi que le swipe est
  plus net après ce lot.

## V24.1.0 — Perf (phase 1 de la refonte)
- xlsx.js, pdf.js et tesseract.js (OCR) ne sont plus chargés à chaque démarrage
  de l'app : ils pesaient plusieurs Mo téléchargés/parsés pour rien tant qu'aucun
  import ni OCR n'était fait. Chargement à la demande via `mhLoadLib()`
  (app-core.js), uniquement quand une fonction d'import/OCR en a besoin.
- Corrige un bug latent lié à `async` sur ces 3 scripts : selon l'ordre de
  chargement réseau, un import pouvait échouer avec "non chargé" même quand la
  lib finissait par arriver une seconde plus tard.
- Suppression du dossier `legacy/inactive/` (v16.2 à v19, ~770 lignes mortes,
  non référencées par le build ni par l'app).
- Aucune formule de paie/temps de travail modifiée : `calcPer()`, `brutOf()`,
  `calcAnc()` dans app-core.js sont inchangées. Vérifié par comparaison
  automatique (script `qa/golden-master.js`) sur les données réelles de
  sauvegarde avant/après ce lot — résultat strictement identique.
- Suite prévue (phase 2, non faite ici) : fusion des fichiers app-v22/v24/
  v24-analysis/v24-features (accumulés patch par patch) en un seul moteur,
  à faire par étapes vérifiées plutôt qu'en un seul bloc.

## V22.0.0 — UX tactile & données fiables
- Navigation principale par swipe gauche/droite entre Accueil, Saisie, Planning et Paie.
- Accueil simplifié : suppression du bloc de sauvegarde permanent et remplacement de « Bonjour 👋 » par « Tableau de bord ».
- Sauvegarde automatique de snapshots désactivée : `save()` reste la persistance locale normale ; export/import JSON reste volontaire et explicite dans Outils > Données.
- Nouveau namespace de points de restauration V22 avec compatibilité de lecture des sauvegardes V21/V18/V17.
- Le dernier JSON fourni est embarqué comme jeu de données initial pour une installation vierge.
- Vérification du jeu de données initial : historique à partir du 19/05/2025, 363 journées, 38 périodes, 372 constats et données présentes jusqu'au 30/09/2026.
- Cache Service Worker étendu aux nouveaux assets V22.
- Version Android : 22.0.0 / versionCode 2200.

## V21.0.0 — Android 17 architecture
- Target/compile SDK 37.
- AGP 9.1.1 + built-in Kotlin/Compose.
- Predictive-back ready ComponentActivity shell.
- Edge-to-edge/adaptive windowing.
- Modern Activity Result API for document flows.
- WebView startup bootstrap, secure asset interception and renderer recovery.
- Debounced local-storage bridge and non-UI widget persistence.

## V25.0.0 — Flow & Live Engine

- Refonte mobile centrée sur un cockpit unique : Accueil, Saisie, Planning, Paie, Analyse.
- Suppression visuelle des blocs V24 redondants sur le tableau de bord.
- Service en temps réel persistant : démarrage/arrêt enregistré dans les données locales avec reprise après fermeture de l'application.
- Calcul live délégué au moteur canonique `cd()` ; suppression du coefficient hardcodé du précédent moteur live.
- Synchronisation continue de l'affichage, des compteurs et du widget Android pendant un service actif.
- Saisie horaire assistée : `8` → `08:00`, `730` → `07:30`, `1730` → `17:30`.
- Nouvelle saisie journalière compacte : horaires, pauses, paniers, note et journée fériée au même endroit.
- Nouveau centre Analyse regroupant trajectoire, tendances, alertes et accès aux contrôles professionnels.
- Les fonctions métier existantes (calcul TTE, amplitude, HS, RC, paie, import AmbuTrack) restent alimentées par le cœur existant.
