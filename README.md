# MesHeures — V21.0.0 Mega Clean

Version active unique : **21.0.0** · Android `versionCode 2050`.

## Architecture
- JavaScript : moteur métier unique (heures, paie, conformité, données).
- Android : WebView, fichiers, widget et dashboard natif.
- Hybrid Core : `WebViewAssetLoader` sur `https://appassets.androidplatform.net/...`.
- Service Worker : cache versionné et interception native des assets.
- Sauvegardes : stockage local, points de restauration, export/import et compatibilité historique.

## Versioning
`VERSION` + `version.properties` sont les sources canoniques. Le build Android lit ces valeurs au lieu de dupliquer le numéro dans Gradle. GitHub Actions vérifie la version de l'APK après compilation.

## Build
Le workflow GitHub Actions lance d'abord `qa/release-audit.py`, puis le contrôle de syntaxe JavaScript, compile l'APK et vérifie `applicationId`, `versionName` et `versionCode` avant publication de l'artifact.

## Historique
Les documents historiques sont archivés sous `docs/history/`. Les anciens fichiers de runtime ne sont pas chargés par l'application.
