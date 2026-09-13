# MesHeures — V20.5.0

## Version
- Android `versionName`: **20.5.0**
- Android `versionCode`: **2050**
- Web runtime: **20.5.0**
- Service Worker cache: `mesheures-shell-v20.5.0`

## Base
Cette version conserve le moteur métier et l'organisation de la V20.3.0 Hybrid Core 2. Les évolutions V20.4/V20.5 sont intégrées de façon additive : elles ne remplacent pas les règles de calcul historiques.

## Évolutions V20.4 / V20.5
- sauvegarde locale renforcée avec compatibilité des anciens formats ;
- protections du cycle de vie avant accès au WebView ;
- Hybrid Core Android avec `WebViewAssetLoader` ;
- interception native du Service Worker via AndroidX WebKit lorsque disponible ;
- durcissement des accès `file://` / `content://` ;
- Service Worker applicatif versionné ;
- navigation mobile, projection, conformité et dashboard hybride ;
- version canonique unique via `VERSION` et `version.properties` ;
- contrôles QA de release et vérification de l'APK.

## Fonctionnalités conservées
- suivi des journées et temps de travail ;
- paie, heures supplémentaires et contrôles légaux ;
- rapprochement et import de documents ;
- sauvegardes et restauration ;
- export / impression ;
- widget Android et deep-links ;
- dashboard natif Compose ;
- système de plugins.

## Organisation
```text
app/          Application Android et WebView
plugins/      SDK / modèle de plugins
qa/           Audits et contrôles qualité
tests/        Tests et références
legacy/       Éléments historiques explicitement isolés
docs/         Documentation historique
.github/      CI GitHub Actions
```

**Règle de maintenance :** un seul README actif à la racine. Les fichiers runtime historiques ne sont jamais chargés depuis l'arborescence Web active.
