# Changelog

## V20.5.0 — Mega Clean Hybrid Core
- Version canonique unique : 20.5.0 / 2050.
- Gradle lit désormais `version.properties`.
- Audit de release renforcé : versions, scripts, Service Worker, runtime actif et workflow.
- Service Worker complet : tous les scripts locaux de l'index sont couverts.
- Interception native des requêtes Service Worker via AndroidX WebKit lorsque disponible.
- WebView durci : pas d'accès file/content inutile.
- Sauvegarde cycle de vie protégée avant que le WebView soit prêt.
- Sauvegardes locales nouvelles versionnées V20.5, avec lecture des anciens formats conservée.
- Labels utilisateur historiques nettoyés sans supprimer les namespaces de compatibilité internes.
