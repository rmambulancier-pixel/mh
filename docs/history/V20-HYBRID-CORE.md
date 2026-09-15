# MesHeures V20 — Hybrid Core

## Objectif
V20 conserve le moteur JavaScript existant comme source unique de vérité et renforce uniquement le socle Android/WebView.

### Architecture
- **Native Android shell** : WebView, cycle de vie, fichiers, impression, widget et bridge Android.
- **HybridCore** : couche dédiée au chargement sécurisé des assets via `WebViewAssetLoader`.
- **Web app** : HTML/CSS/JavaScript existants, sans duplication des règles de paie ou du moteur légal.
- **Service Worker** : activable dans l'app packagée grâce à l'origine HTTPS `appassets.androidplatform.net`.

### Interception
Les requêtes de l'origine `https://appassets.androidplatform.net/assets/` sont servies par `WebViewAssetLoader`. Les autres requêtes ne sont pas détournées par le cœur natif et restent gérées par WebView.

### Service Worker
L'enregistrement est explicite avec un scope relatif `./`. Le cache est versionné en `v20.0.0`.

### Ce qui n'est volontairement pas modifié
- calculs de paie ;
- règles légales ;
- données métier ;
- interface utilisateur ;
- stratégie de sauvegarde localStorage.

## Validation requise
La compilation et le test réel sur appareil doivent encore confirmer :
1. build APK ;
2. chargement initial ;
3. enregistrement du Service Worker ;
4. fonctionnement hors ligne ;
5. widget/deep-links ;
6. import/export et impression.
