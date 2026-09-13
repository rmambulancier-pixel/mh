# V19.0.0 — audit de consolidation

## Widget
- RemoteViews réduite à des vues officiellement supportées et primitives.
- Suppression du ProgressBar XML/tint et du ColorFilter dynamique.
- Fallback visuel possible sans payload.
- Profondeur par défaut : 4 cellules.

## Version
- Runtime : 19.0.0
- Android versionCode : 1830
- Widget : V8

## Démarrage
- `MainActivity.onPageFinished()` force `tab('home')` lors d'un lancement normal.
- Les deep-links widget restent prioritaires lorsqu'ils sont explicitement fournis.

## Release
- R8 + shrinkResources activés.
- Règles ProGuard présentes pour le bridge JS et le provider widget.

## Validation locale
- XML parsés avec le parseur XML Python.
- Java : contrôles structurels + compilation réelle à faire par GitHub Actions (SDK Android absent de cet environnement).
- JavaScript : `node --check` sur les scripts runtime.
