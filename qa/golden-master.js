// Usage : node qa/golden-master.js app/src/main/assets/web
// Golden-master : charge app-core.js (moteur métier, INCHANGÉ par la refonte)
// et calcule la paie sur les vraies données de sauvegarde, pour prouver
// qu'aucune formule n'a bougé après restructuration du chargement des scripts.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const coreDir = process.argv[2]; // dossier web/ à tester
const backup = JSON.parse(
  fs.readFileSync(path.join(coreDir, 'data/mesheures-default-backup.json'), 'utf8')
).data;

const code = fs.readFileSync(path.join(coreDir, 'scripts/app-core.js'), 'utf8');

const sandbox = {
  window: {},
  document: { getElementById: () => null },
  console,
  __BACKUP__: { s: backup.s, days: backup.days, cmp: backup.cmp, periods: backup.periods,
        bul: backup.bul, bulletins: backup.bulletins, romi: backup.romi,
        per: backup.per, exp: backup.exp }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox); // le script fait "let DB=..." -> écrase toute valeur pré-injectée
vm.runInContext('Object.assign(DB, __BACKUP__);', sandbox); // on réinjecte les vraies données APRÈS

// calcPer / brutOf / calcAnc sont des déclarations top-level du script :
// on les récupère via runInContext direct sur le contexte déjà peuplé.
const probe = `
  ({
    per: DB.per,
    G: (function(){ const r = calcPer(DB.per.start, DB.per.nb); return r.G; })(),
    alerts: calcPer(DB.per.start, DB.per.nb).AL.length,
    brut: brutOf(calcPer(DB.per.start, DB.per.nb).G).tot,
    anc: calcAnc(DB.s.emb)
  })
`;
const result = vm.runInContext(probe, sandbox);
console.log(JSON.stringify(result, null, 2));
