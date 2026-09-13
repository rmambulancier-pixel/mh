
## V15.3
MesHeures V15.3 regroupe le dashboard, le calendrier intelligent, la synthèse paie, l’audit renforcé, le rapprochement bulletin, les statistiques historiques et le centre de sauvegarde/restauration. Le moteur de calcul historique reste inchangé.
# 🚑 MesHeures — Gestion & Suivi Paie Ambulancier

> Application Web Progressive (PWA) dédiée au suivi des temps de travail, au calcul de la paie et au rapprochement des bulletins officiels pour le personnel ambulancier.

---

## 🌟 Fonctionnalités Principales

* 📅 **Suivi Quotidien & Mensuel** : Enregistrement des amplitudes, des temps de travail effectif (TTE), des pauses et des paniers (IR / IRU).
* 📈 **Audit & Quatorzaines** : Calcul automatique des heures supplémentaires (25% / 50%), des repos compensateurs (RC) et projection de fin de période.
* 📄 **Rapprochement Paie & ROMI1** : Analyse intelligente des fichiers PDF officiels (bulletins employeur et relevés ROMI1) pour neutraliser les écarts.
* 📱 **Mode PWA (Progressive Web App)** : Installation directe sur l'écran d'accueil du smartphone, fonctionnement hors ligne et mises à jour instantanées.

---

## 📂 Structure du Projet (Pure PWA)

```text
📦 mesheures/
┣ 📜 index.html        # Cœur de l'application (Interface, moteurs de calcul, parseurs PDF)
┣ 📱 manifest.json     # Configuration de l'application mobile (PWA)
┣ 🎨 icon.svg          # Identité visuelle vectorielle
┗ 📖 README.md         # Documentation du projet
