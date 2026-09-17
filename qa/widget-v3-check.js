const fs=require('fs');
global.window={};
const backup=JSON.parse(fs.readFileSync('/mnt/data/MesHeures-backup-V18-2026-09-13.json','utf8')).data;
let core=fs.readFileSync('app/src/main/assets/web/scripts/app-core.js','utf8');
core += `\nDB=${JSON.stringify(backup)};\nconst ym='2026-09';\nconst m={tte:0,trav:0}; for(let d=1;d<=30;d++){const k=ym+'-'+String(d).padStart(2,'0'); const r=cd(k); m.tte+=r.tte; m.trav+=r.trav;}\nconst st=DB.per.start, nb=DB.per.nb; const G=calcPer(st,nb).G; const br=brutOf(G); const p=window.mhCurrentPaySummary(); console.log(JSON.stringify({month:m,payPeriod:{st,nb,tte:G.tte,hs25:G.h25,hs50:G.h50,gross:br.tot,net:br.tot*DB.s.net+br.panIR+br.panIRU},summary:p,bulletin:DB.bulletins[0]?.mois},null,2));`;
eval(core);
