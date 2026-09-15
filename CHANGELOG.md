# Changelog

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
