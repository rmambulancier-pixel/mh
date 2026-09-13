# MesHeures V19.0.0 — audit de structure

## Vérifications statiques
- applicationId conservé : `com.mesheures.app`
- versionName : `19.0.0`
- versionCode : `1900`
- Kotlin 2.0.21 + Compose compiler plugin 2.0.21
- Compose BOM 2024.09.03
- Dashboard natif limité à la lecture du payload partagé
- moteur métier JS non remplacé
- widget provider conservé
- bridge Java conservé et étendu

## Point de build
Le SDK Android/Gradle n'est pas installé dans l'environnement de travail local. Le build final doit donc être validé par GitHub Actions avant installation sur le Pixel.
