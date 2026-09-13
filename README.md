# MesHeures — V20.4.0 Clean Release

Version active unique : **20.4.0** · Android `versionCode 2040`.

## Architecture
- JavaScript : moteur métier unique (heures, paie, contrôle et données).
- Android : couche plateforme / WebView / fichiers / widget / impression / dashboard natif.
- Hybrid Core : `WebViewAssetLoader` via `https://appassets.androidplatform.net/assets/web/index.html`.
- Service Worker : cache versionné `mesheures-shell-v20.4.0`.

## Règle de version
`VERSION` et `version.properties` sont les sources canoniques de release. Le build refuse une incohérence avant compilation et vérifie la version de l'APK après compilation.

## Build
Le workflow GitHub Actions produit uniquement `MesHeures-APK-release-v20.4.0` et vérifie `versionCode=2040`, `versionName=20.4.0` et `applicationId=com.mesheures.app`.

Les fichiers et documents historiques sont archivés sous `docs/history/` ou `legacy/inactive/` et ne sont pas chargés par l'application.
