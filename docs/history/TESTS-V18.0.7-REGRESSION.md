# MesHeures V18.0.8 — régression / conservation

## Corrections
- Thème clair : couche de compatibilité finale sur les anciennes surfaces V10/V15/V17 et les modules V18.
- Preuves : audit historique effectué une seule fois par rafraîchissement de données, puis résultat mis en cache jusqu'au prochain `save()`.
- Constats : détection des doublons avec `Set` plutôt qu'une recherche linéaire dans tout l'historique.
- Mode Jour : `tab('jour')` initialise toujours la date courante si nécessaire.
- Bouton « Effacer tout » : fonction `wipe()` restaurée avec confirmation explicite.
- Impression : conservation du bridge Android natif et du fallback navigateur.

## Conservation
- Aucun module métier V18 supprimé.
- Les anciens fichiers inactifs éventuellement présents sont conservés sous `legacy/inactive/` et ne sont ni chargés ni précachés.
- Le moteur de calcul de paie n'est pas modifié.
- Les plugins et leurs permissions restent présents.
