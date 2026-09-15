# MesHeures — V22.0.0

Version active : **22.0.0** · Android `versionCode 2200`.

## V22
- Navigation tactile par swipe entre les écrans principaux.
- Tableau de bord plus compact et professionnel.
- Persistance locale normale conservée via `save()`.
- Les snapshots automatiques ne sont plus créés à chaque lancement ; les sauvegardes JSON restent disponibles volontairement dans Outils > Données.
- Compatibilité de lecture des anciens points de restauration V21/V18/V17.
- Le JSON de référence fourni avec V22 est utilisé uniquement lors d'une installation vierge et commence au **19/05/2025**.

## Architecture
- JavaScript : moteur métier unique (heures, paie, conformité, données).
- Android : WebView, fichiers, widget et dashboard natif.
- Hybrid Core : `WebViewAssetLoader` sur `https://appassets.androidplatform.net/...`.
- Service Worker : cache versionné et interception native des assets.

## Versioning
`VERSION` + `version.properties` sont les sources canoniques. Le build Android lit ces valeurs au lieu de dupliquer le numéro dans Gradle.

## QA
Les audits V22 passent avant compilation : version, assets, Service Worker, sécurité WebView, predictive back, Activity Result API, cible Android 17 et contrôles de performance.
