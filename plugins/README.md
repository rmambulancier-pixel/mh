# MesHeures Plugin SDK — V18.0.14

Un fichier `.mhplugin` est un JSON contenant `format`, `manifest`, `html`, `css` et `script`.

## Permissions disponibles
- `snapshot` : statistiques du mois courant.
- `days` : historique synthétisé des journées (lecture seule).
- `pay` : quatorzaine et bulletins importés (lecture seule).
- `evidence` : constats et événements (lecture seule).
- `legal` : règles/audits disponibles (lecture seule).

## API
Depuis le script du plugin :
```js
parent.postMessage({type:'mhx-request', action:'snapshot'}, '*');
window.addEventListener('message', e => {
  if(e.data?.type === 'mhx-data') console.log(e.data.action, e.data.data);
});
```

Le plugin ne doit jamais tenter de modifier le parent. Les appels sans permission sont ignorés.
