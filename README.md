# MesHeures V18.0.14 — Android + PWA

MesHeures est une application de suivi du temps de travail conçue pour le **transport sanitaire**, avec un focus sur le suivi des ambulanciers : saisie terrain, décompte par quatorzaine, projection, contrôle des amplitudes et du temps de travail, suivi de la paie, import de documents et sauvegardes locales.

> **Version actuelle : V18.0.14 — versionCode Android 1814**

## V18.0.14 — audit final et stabilisation

- Export/import/backup Android routés vers le sélecteur natif « Enregistrer sous » du WebView.
- Import et restauration remplacent proprement l’ensemble du modèle de données connu, avec valeurs par défaut pour les blocs absents.
- Barre d’état et barre de navigation Android suivent le thème clair/sombre sélectionné, notamment sur les appareils récents comme le Pixel 10 Pro XL.
- Métadonnées synchronisées : interface, manifest PWA, Service Worker, modules, Android et workflow CI en `18.0.14` / `versionCode 1814`.
- Suppression d’un ancien CSS non référencé et renommage des modules actifs dont le nom portait un ancien numéro (`app-pay.js`, `app-v18.js`).
- Contrôles statiques : 15 scripts actifs présents dans HTML et Service Worker, références de ressources valides, syntaxe JavaScript/CSS/HTML valide.
- Aucune donnée métier ni fonctionnalité utilisateur supprimée.

## Fonctionnalités V18

### 🏠 Tableau de bord
- TTE du jour
- cumul de quatorzaine
- solde avant heures supplémentaires
- alertes de conformité hiérarchisées

### ⏱️ Temps de travail
- suivi du TTE
- décompte par quatorzaine
- suivi des heures supplémentaires
- gestion des majorations
- prise en compte du planning dans les projections

### 🔮 Projection intelligente
La projection de fin de quatorzaine s'appuie en priorité sur les **journées futures réellement planifiées comme travaillées**.

Les journées futures non renseignées ne sont pas transformées artificiellement en journées travaillées. Elles sont signalées afin d'éviter une projection trompeuse.

### 💶 Paie
- moteur de calcul des heures normales et supplémentaires
- majorations 25 % / 50 % selon les règles configurées
- estimation du brut
- taux horaire personnel configurable
- **base personnelle par défaut : 14,20 € brut/h hors prime d'ancienneté**
- prime d'ancienneté traitée séparément
- comparaison entre temps calculé et éléments du bulletin lorsque les données sont disponibles

### ⚖️ Contrôle légal — transport sanitaire
Référentiel dédié au transport sanitaire et à la convention collective des transports routiers, avec contrôles notamment sur :

- amplitude
- temps de travail effectif
- limites hebdomadaires
- moyenne sur période de référence
- repos quotidien
- pauses
- heures supplémentaires
- minima conventionnels
- indemnités et éléments spécifiques applicables

Le référentiel est daté et doit être revérifié lorsque les textes évoluent.

### 📄 Bulletins, ROMI1 et OCR
- import de documents
- extraction OCR
- validation avant intégration des données extraites
- possibilité de corriger les valeurs détectées
- contrôle des incohérences avant ajout à l'historique

### 💾 Sauvegardes locales
MesHeures V17 privilégie le stockage local et le fonctionnement hors connexion.

- sauvegarde automatique locale
- points de restauration
- export complet en JSON
- import JSON versionné
- sauvegarde automatique avant import/restauration
- restauration des données locales
- fonctionnement sans compte ni serveur obligatoire

### 📤 Exports
Selon les modules disponibles :
- JSON pour sauvegarde complète
- CSV pour exploitation dans un tableur
- rapports pour contrôle et archivage

### 📱 Interface mobile
Navigation basse simplifiée :

**Accueil · Saisie · Planning · Paie · Outils**

Les fonctions secondaires sont regroupées dans Outils afin de conserver un maximum de place sur smartphone.

### 🌙 Apparence
- Clair
- Sombre
- Automatique selon le système de l'appareil

### 🔌 PWA / hors connexion
L'application embarque la PWA MesHeures dans l'APK Android et conserve ses données localement. Les bibliothèques externes ne doivent pas empêcher l'affichage initial de l'application.

## Référentiel réglementaire

La V17 intègre un référentiel de contrôle orienté **transport sanitaire / CCN des transports routiers (IDCC 0016)** et Code du travail.

Les règles sont utilisées comme aide au contrôle et à la détection d'écarts. Une situation individuelle peut dépendre du contrat de travail, d'un accord d'entreprise, du planning, des justificatifs ou d'une disposition conventionnelle particulière.

**Date de vérification du référentiel intégré dans cette version : 11/09/2026.**

## Intelligence locale — V18.0.1

### 🧠 Détection de motifs
- recherche de récurrences sur l’historique des journées travaillées
- dimanches travaillés à périodicité proche de 14 jours
- contrôle indicatif des RC saisis après les dimanches travaillés
- répétition des amplitudes > 12 h
- répétition des TTE > 10 h
- répétition des journées sans pause détectée
- aucun machine learning : règles statistiques simples et auditables

### 📈 Projection 46 h / 12 semaines
- fenêtre glissante de 12 semaines
- séparation entre historique réel et journées futures planifiées
- estimation des futures journées travaillées uniquement lorsqu’un planning les identifie
- journées futures inconnues jamais transformées en heures fictives
- détection de la première date de risque lorsque la trajectoire connue dépasse 46 h de moyenne

### 🚨 Alertes prédictives
- alerte locale de trajectoire
- mémorisation du franchissement pour éviter les notifications répétitives
- notification système si les permissions de l’appareil l’autorisent
- l’alerte reste visible dans l’application si les notifications système ne sont pas disponibles

## Dossier complet — V18.0.5 Lot 3

Le Lot 3 ajoute un export probatoire unique :
- dossier JSON regroupant les journées, bulletins, constats, événements et résultats d’intelligence locale ;
- dossier imprimable permettant un enregistrement en PDF depuis Android ou navigateur ;
- empreinte SHA-256 du dossier pour vérifier qu’un export n’a pas été modifié ;
- synthèse automatique de la période couverte et des éléments chiffrés ;
- aucun envoi serveur : le dossier est généré localement à partir des données présentes sur l’appareil.

L’empreinte est une mesure d’intégrité de l’export, pas une signature juridique.

## Architecture

```text
app/src/main/
├── java/com/mesheures/app/
│   └── MainActivity.java
└── assets/web/
    ├── index.html
    ├── manifest.json
    ├── sw.js
    ├── style/
    └── scripts/
        ├── app-core.js
        ├── app-ui.js
        ├── app-parser.js
        ├── app-pwa.js
        ├── app-plugins.js
        ├── app.js
        ├── app-legal.js
        ├── app-projection.js
        ├── app-backup.js
        └── app-v18.js
```

## Android

- Application ID : `com.mesheures.app`
- compileSdk : 35
- targetSdk : 35
- minSdk : 26
- Java : 17
- Gradle : 8.9
- Android Gradle Plugin : 8.7.3
- versionCode : 1807
- versionName : 18.0.13

La signature de release repose sur la clé persistante configurée dans les secrets GitHub Actions. **Le keystore privé n'est pas stocké dans le dépôt.**

## Build GitHub Actions

Le workflow :

```text
.github/workflows/build-apk.yml
```

produit l'APK Android à partir de la branche `main`.

Les secrets de signature nécessaires sont configurés dans les paramètres du dépôt. Ils ne doivent jamais être ajoutés au code source.

## Installation / mise à jour

Pour une mise à jour normale :

1. construire l'APK signée via GitHub Actions ;
2. installer la nouvelle version par-dessus l'ancienne ;
3. conserver la même clé de signature et augmenter le `versionCode`.

Une désinstallation n'est pas nécessaire pour une mise à jour signée compatible.

## Sauvegarde des données

Avant une évolution importante ou un changement de build, il est recommandé d'effectuer un **export JSON complet** depuis MesHeures. Le fichier JSON constitue une sauvegarde portable des données de l'application.

## Extensions / plugins — V18.0.5 Lot 6

MesHeures dispose d’un système d’extensions `.mhplugin` permettant d’ajouter des modules sans modifier le cœur de l’application.

- exécution dans un `iframe` sandboxé ;
- pas d’accès direct au DOM MesHeures ;
- CSP du cadre plugin sans réseau ;
- permissions explicites et strictement en lecture seule : `snapshot`, `days`, `pay`, `evidence`, `legal` ;
- installation validée par manifeste et taille maximale de 180 Ko ;
- refus des permissions inconnues ;
- activation/désactivation et désinstallation ;
- export/import des plugins utilisateur en format V2 ;
- quatre extensions officielles : Mes Droits, Statistiques, Bulletin+, Dossier Prud’hommes.

Règle d’architecture : une extension peut **lire, analyser, afficher et proposer**, mais ne peut jamais **écrire, supprimer ou modifier les heures, les paramètres ou le moteur de paie**.

### V18.0.5
- Lot 6 : écosystème plugins en lecture seule + quatre extensions officielles
- API permissions explicites et validation renforcée
- kit développeur dans `plugins/`
- Android versionCode 1805 / versionName 18.0.5
- cache PWA et workflow APK alignés en 18.0.5

## Historique rapide

### V18.0.4
- Lot 5 : premier système plugins sandboxé et correction du numéro de version

### V18.0.3
- Lot 4 : rapprochement paie / temps / bulletins

### V18.0.2
- Lot 3 : dossier complet exportable JSON/PDF
- empreinte SHA-256 d’intégrité de l’export
- regroupement historique + constats + événements + bulletins + intelligence locale
- version Android/PWA/cache/workflow synchronisée en 18.0.2

### V18.0.1
- intelligence locale : motifs récurrents, projection 46 h/12 semaines et alertes prédictives
- version Android/PWA/cache synchronisée en 18.0.1

### V17.0.1
- nettoyage dupliqué des exports JSON : un seul moteur V17 fait foi
- suppression de l’ancien `pay-fix-v16.2.js` fantôme à la racine ; le correctif de paie actif est désormais `app-pay.js`
- précache PWA complet incluant le correctif paie
- démarrage du correctif paie dès `DOMContentLoaded` pour éviter une course d’affichage
- version Android/PWA/cache synchronisée en 17.0.1

### V17.0.0
- refonte de la navigation mobile
- projection basée sur le planning futur
- moteur paie renforcé
- contrôle légal transport sanitaire
- sauvegardes et restauration JSON renforcées
- thème automatique
- sécurisation des imports OCR
- base Android réparée conservée comme référence

### V16.2.x
- stabilisation Android
- signature release persistante
- sauvegarde LocalStorage côté Android
- correctifs paie et quatorzaines

## Licence / usage

Projet personnel et outil de suivi. Les règles réglementaires affichées dans l'application constituent un **outil d'aide au contrôle** et ne constituent pas un avis juridique.


## V18.0.13 — maintenance thème, performances et régression

- Thème clair renforcé sur les anciennes couches CSS V10/V15/V17 ainsi que les panneaux V18 : cartes, formulaires, navigation basse, calendrier, paie, plugins, preuves, modales et écran de démarrage suivent désormais le thème clair.
- Module de preuves optimisé : calcul historique mis en cache et invalidé uniquement lors d’une sauvegarde de données.
- Détection des constats déjà présents passée d’une recherche linéaire à un `Set`.
- Audit historique regroupé en une seule passe au lieu de relancer l’audit sur chaque bloc de 14 jours.
- Bouton « Effacer tout » restauré avec confirmation explicite.
- Mode Jour initialise systématiquement une date valide lors de l’ouverture de l’onglet.
- Aucun module V18 métier supprimé ; les fichiers historiques éventuellement inactifs sont conservés hors du bundle actif.
- Version synchronisée : Android `18.0.13` / `versionCode 1813`, PWA, Service Worker, manifest et interface.

## V18.0.13 — correctif interface, Jour et impression

- Suppression du menu de navigation supérieur redondant : la navigation passe par le menu inférieur et le panneau Outils existants.
- Navigation rendue tolérante à l'absence des anciens boutons supérieurs : aucune fonction métier n'est supprimée.
- Mode **Jour** sécurisé : changement d'onglet et rendu ne dépendent plus de boutons du menu supérieur.
- Impression Android réparée via le moteur d'impression natif (`PrintManager`). Le navigateur/PWA conserve `window.print()`.
- Impression du dossier complet routée vers l'impression native Android lorsqu'elle est disponible.
- Vérification statique des boutons et des fonctions de navigation ; les actions existantes (saisie, planning, paie, audit, bulletins, ROMI1, réglages, sauvegardes, plugins, exports) sont conservées.
- Version synchronisée : Android `18.0.13` / `versionCode 1813`, PWA, Service Worker et interface.

## V18.0.5 — Lot 6 : écosystème plugins
- API plugins en lecture seule avec permissions explicites : `snapshot`, `days`, `pay`, `evidence`, `legal`.
- Un plugin ne peut jamais écrire dans `DB`, modifier les journées, modifier les paramètres de paie ou appeler le moteur de paie pour changer ses résultats.
- Exécution dans un iframe sandboxé avec CSP locale sans réseau.
- 4 extensions officielles intégrées : Mes Droits, Statistiques, Bulletin+, Dossier Prud’hommes.
- Import `.mhplugin` conservant validation d’identifiant, taille maximale 180 Ko et refus des permissions inconnues.
- Export/import des extensions utilisateur en format V2.
- Android `versionName 18.0.5` / `versionCode 1805`.
- Numéro de version aligné entre interface, PWA, cache, Android et workflow.

### Règle d’architecture
Les plugins peuvent **lire, analyser, afficher et proposer**. Ils ne peuvent pas **écrire, supprimer ou recalculer/modifier** les données du cœur. Toute évolution future de l’API devra ajouter une permission explicite et rester en lecture seule par défaut.


## V18.0.13 — Correctif thème clair complet
- Correction finale des surfaces héritées sombres en mode clair : tableaux Paie/Bulletin, vue Mois, cellules calendrier, totaux hebdomadaires, Planning, cartes dashboard, graphiques et navigation mobile.
- Les couleurs métier Travail/CP/RC/Nuit/Alerte restent différenciées.
- Aucune donnée ni fonctionnalité supprimée.
- Version Android 18.0.13 / versionCode 1813, PWA, manifest, Service Worker et workflow synchronisés.
