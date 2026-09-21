/* MesHeures V32.2 — Feuille de route hebdomadaire transport sanitaire */
(function(){
'use strict';
const C={company:"SARL AMBULANCE DE L'UBY",address:"57 rue de Gascogne · 32150 Cazaubon",siret:"79916160900018",employee:"Roth Mickaël",job:"Ambulancier DEA"};
const D=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const E=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const dt=s=>{let[a,b,c]=String(s).split('-').map(Number);return new Date(a,b-1,c)};
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0');
const add=(s,n)=>typeof addD==='function'?addD(s,n):(()=>{let d=dt(s);d.setDate(d.getDate()+n);return iso(d)})();
const mon=s=>{let d=dt(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d)};
const min=t=>{if(!t||!/^\d{2}:\d{2}$/.test(t))return null;let[a,b]=t.split(':').map(Number);return a*60+b};
const H=m=>m==null?'—':Math.floor(Math.round(m)/60)+"h"+String(Math.round(m)%60).padStart(2,'0');
const SD=s=>{let d=dt(s);return String(d.getDate()).padStart(2,'0')+"/"+String(d.getMonth()+1).padStart(2,'0')+"/"+d.getFullYear()};
function pm(d){let n=0;(d.p||[]).forEach(p=>{let a=min(p.d),b=min(p.f);if(a!=null&&b!=null)n+=(b<a?b+1440:b)-a});return n}
function mc(d){let a=min(d.deb),b=min(d.fin);if(a==null||b==null)return 0;b=b<=a?b+1440:b;let cur=a,max=0,ps=(d.p||[]).map(p=>{let x=min(p.d),y=min(p.f);if(x==null||y==null)return null;if(y<=x)y+=1440;while(x<a){x+=1440;y+=1440}return{x,y}}).filter(Boolean).sort((x,y)=>x.x-y.x);ps.forEach(p=>{max=Math.max(max,p.x-cur);cur=Math.max(cur,p.y)});return Math.max(max,b-cur)}
function meal(d){let a=min(d.deb),b=min(d.fin);if(a==null||b==null)return null;b=b<=a?b+1440:b;for(let w of [[660,870],[1110,1320]])if(a<=w[0]&&b>=w[1]){let ok=(d.p||[]).some(p=>{let x=min(p.d),y=min(p.f);if(x==null||y==null)return false;if(y<=x)y+=1440;while(x<a){x+=1440;y+=1440}return y-x>=30&&x>=w[0]&&y<=w[1]});return{ok}}return null}
function rows(s){let o=[];for(let i=0;i<7;i++){let k=add(s,i),d=DB.days[k]||{t:'REPOS',p:[]},r=typeof cd==='function'?cd(k):{tte:0},a=min(d.deb),b=min(d.fin),work=(d.t==='T'||d.t==='NUIT')&&a!=null&&b!=null,amp=work?((b<=a?b+1440:b)-a):0;o.push({k,d,r,work,label:D[i]+" "+SD(k),status:{
  CP:'CONGÉS PAYÉS',
  RC:'REPOS COMPENSATEUR',
  MAL:'MALADIE',
  FORMATION:'FORMATION',
  MISE_A_NIVEAU:'MISE À NIVEAU DIPLÔME',
  VISITE_MEDICALE:'VISITE MÉDICALE',
  REUNION:'RÉUNION',
  AUTRE_ACTIVITE:'AUTRE ACTIVITÉ',
  NUIT:'NUIT',
  T:'TRAVAIL',
  REPOS:'REPOS'
}[d.t]||String(d.t||'REPOS').replaceAll('_',' '),amp,tte:work?Math.max(0,+r.tte||0):0,pause:pm(d),max:mc(d),meal:work?meal(d):null,sa:work?a+i*1440:null,ea:work?((b<=a?b+1440:b)+i*1440):null,holiday:!!d.fer,perm:d.perm||d.permanence||'',tasks:d.tasks||d.taches||d.activites||'',note:d.note||''})}return o}
function dailyTTE(x){
  if(!x.work)return 0;
  return Math.max(0,+x.tte||0);
}
function dailyAmp(x){
  return x.work?Math.max(0,+x.amp||0):0;
}
function checks(r){let a=[];r.forEach(x=>{if(!x.work)return;if(x.amp>840)a.push(["critical",x.label+" : amplitude > 14 h — dépassement à justifier."]);else if(x.amp>720)a.push(["warn",x.label+" : amplitude > 12 h — motif réglementaire/contrepartie à vérifier."]);if(x.max>=360&&x.pause<20)a.push(["warn",x.label+" : aucune pause de 20 min ou plus détectée."]);if(x.meal&&!x.meal.ok)a.push(["warn",x.label+" : pause repas d'au moins 30 min dans la plage concernée à vérifier."])});let w=r.filter(x=>x.work).sort((a,b)=>a.ea-b.ea);for(let i=1;i<w.length;i++)if(w[i].sa-w[i-1].ea<660)a.push(["warn",w[i].label+" : repos entre services < 11 h — vérifier la dérogation."]);let t=r.reduce((s,x)=>s+x.tte,0);if(t>2880)a.push(["critical","Cumul hebdomadaire TTE > 48 h — anomalie à traiter."]);return a}
function make(s){let r=rows(s),a=checks(r),amp=r.reduce((x,y)=>x+y.amp,0),tte=r.reduce((x,y)=>x+y.tte,0),alerts=a.length?a.map(x=>`<div class="a ${x[0]}"><b>${x[0]==='critical'?'ANOMALIE':'À VÉRIFIER'}</b> · ${E(x[1])}</div>`).join(''):'<div class="a ok"><b>OK</b> · Aucun contrôle de base en anomalie.</div>';
let d=dt(s);d.setDate(d.getDate()+3);let y=d.getFullYear(),ys=new Date(y,0,1),wn=Math.ceil((((d-ys)/86400000)+1)/7);let weekTitle=`Feuille de route — Semaine ${wn} — ${SD(s)} au ${SD(add(s,6))}`;
let body= r.map(x=>{if(!x.work){let detail=x.note||x.tasks||'';return `<tr class="off status-${x.d.t||"REPOS"}"><td colspan="8"><div class="status-row"><span class="status-date">${E(x.label)}</span><span class="status-sep">—</span><span class="status-name">${E(x.status)}</span></div>${x.holiday?`<div class="status-note">JOUR FÉRIÉ</div>`:''}${detail?`<div class="status-detail">${E(detail)}</div>`:''}</td></tr>`}return `<tr><td><b>${E(x.label)}</b>${x.holiday?' · FÉRIÉ':''}</td><td>${x.d.deb||'—'}</td><td>${(x.d.p||[]).filter(p=>p&&(p.d||p.f)).map(p=>(p.d||'??')+'–'+(p.f||'??')+(p.ty?' · '+p.ty:'')).join('<br>')||'—'}</td><td>${x.d.fin||'—'}</td><td class=num><b>${x.work?H(dailyAmp(x)):'—'}</b>${x.work?`<br><span class="tjed">TTE ${H(dailyTTE(x))}</span>`:''}</td><td>${E(x.perm)||'—'}</td><td>${E(x.tasks)||(x.note?'Note : '+E(x.note):'—')}</td><td></td></tr>`}).join('');
return `<!doctype html><html lang=fr><meta charset=utf-8><title>${E(weekTitle)}</title><style>
@page{size:A4;margin:8mm}
body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:8pt;margin:0}
*{box-sizing:border-box}
.head{border:1.5px solid #111;padding:7px;margin-bottom:5px}
.g{display:grid;grid-template-columns:1.7fr 1fr 1fr;gap:7px}
.title{font-size:13pt;font-weight:800}
table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{display:table-header-group}
tr{break-inside:avoid;page-break-inside:avoid}
th,td{border:1px solid #222;padding:3px;vertical-align:middle;overflow-wrap:anywhere;word-break:break-word}
th{background:#e9ecef;text-align:center;font-size:7.2pt}
th:nth-child(1){width:11%} th:nth-child(2){width:9%} th:nth-child(3){width:17%}
th:nth-child(4){width:9%} th:nth-child(5){width:7%} th:nth-child(6){width:8%}
th:nth-child(7){width:28%} th:nth-child(8){width:11%}
.num{text-align:center;white-space:nowrap}.tjed{font-size:6.5pt;font-weight:600;color:#555;white-space:nowrap}
.off td{padding:0;border-left:1px solid #222;border-right:1px solid #222;color:#111}
.status-row{width:100%;min-height:30px;display:grid;grid-template-columns:36% 6% 58%;align-items:center;padding:5px 12px;gap:0;font-weight:700}
.status-date{font-size:10.5pt;white-space:nowrap}
.status-sep{text-align:center;font-size:11pt}
.status-name{font-size:12pt;letter-spacing:.15px;white-space:nowrap}
.status-note{padding:0 12px 3px;font-size:6.5pt;font-weight:700}
.status-detail{padding:0 12px 5px;font-size:7pt;font-weight:400;overflow-wrap:anywhere}
.status-CP td,.status-FORMATION td,.status-MISE_A_NIVEAU td,.status-VISITE_MEDICALE td,.status-REUNION td,.status-AUTRE_ACTIVITE td{background:#eef8ee}
.status-RC td{background:#eef4fb}
.status-MAL td{background:#fff5e8}
.status-REPOS td{background:#f5f5f5}
@media print and (orientation:portrait){
 .status-row{grid-template-columns:38% 6% 56%;padding:4px 7px}
 .status-date{font-size:8.2pt}
 .status-sep{font-size:8.5pt}
 .status-name{font-size:9.2pt}
 .status-note{font-size:5.5pt}
 .status-detail{font-size:5.8pt}
}
.sum{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:5px;break-inside:avoid;page-break-inside:avoid}
.box{border:1px solid #333;padding:4px;text-align:center}
.box b{display:block;font-size:10pt}
.a{border-left:4px solid #777;background:#f4f4f4;padding:4px 6px;margin:2px 0;font-size:7.2pt;overflow-wrap:anywhere;break-inside:avoid}
.warn{border-left-color:#b36b00;background:#fff8e8}
.critical{border-left-color:#a40000;background:#fff0f0}
.ok{border-left-color:#287a2b;background:#eef8ee}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:6px;break-inside:avoid;page-break-inside:avoid}
.s{border:1px solid #222;min-height:40px;padding:4px}
.foot{margin-top:5px;font-size:6.4pt;color:#444;line-height:1.3;overflow-wrap:anywhere}
@media print and (orientation:portrait){
 body{font-size:6.8pt}
 .head{padding:5px;margin-bottom:4px}
 .g{grid-template-columns:1.4fr 1fr 1fr;gap:4px}
 .title{font-size:10pt}
 th{font-size:5.8pt;padding:2px}
 th,td{padding:2.2px}
 th:nth-child(1){width:12%} th:nth-child(2){width:9%} th:nth-child(3){width:19%}
 th:nth-child(4){width:9%} th:nth-child(5){width:8%} th:nth-child(6){width:9%}
 th:nth-child(7){width:23%} th:nth-child(8){width:11%}
 .a,.foot{font-size:5.7pt}
 .box{padding:2px;font-size:5.8pt}
 .box b{font-size:8pt}
 .sig{gap:4px}
 .s{min-height:34px;padding:3px}
}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style><body>
<div class=head><div class=g><div><div class=title>FEUILLE DE ROUTE HEBDOMADAIRE</div>Transport sanitaire · feuille individuelle</div><div><b>Entreprise</b><br>${E(C.company)}<br>${E(C.address)}<br>SIRET ${E(C.siret)}</div><div><b>Salarié</b><br>${E(C.employee)}<br>${E(C.job)}</div></div><div style="margin-top:5px"><b>Semaine n° ${wn}</b> · du <b>${SD(s)}</b> au <b>${SD(add(s,6))}</b> · Généré le ${SD(iso(new Date()))}</div></div>
<table><thead><tr><th>Jour</th><th>Heure de prise<br>de service</th><th>Pause(s) réglementaire(s) et/ou repas<br>Début – Fin · Lieu</th><th>Heure de fin<br>de service</th><th>Amplitude<br>journalière<br><small>+ TTE jour</small></th><th>Permanence<br>Type 1 / 2 / 3</th><th>Tâches complémentaires<br>ou activités annexes</th><th>Signature(s)</th></tr></thead><tbody>${body}</tbody></table>
<div class=sum><div class=box><b>${r.filter(x=>x.work).length}</b>jours travaillés</div><div class=box><b>${H(amp)}</b>amplitude cumulée</div><div class=box><b>${H(tte)}</b>TTE calculé</div></div>
<div class=sig><div class=s><b>Employeur / représentant</b><br><br>Signature :</div><div class=s><b>Salarié</b><br><br>Signature :</div></div>
<div class=foot><b>Observations éventuelles :</b> ___________________________________________________________________________________________<br>
(1) Lieu : <b>ENT</b> = entreprise · <b>DOM</b> = domicile · <b>EXT</b> = extérieur. La feuille doit être signée chaque jour ou, en cas d'impossibilité, dans les meilleurs délais et, en tout état de cause, chaque semaine.<br>
Document généré par MesHeures et structuré selon le modèle réglementaire. Références : arrêté du 19 décembre 2001 modifié le 18 août 2009 · accord du 16 juin 2016.</div>
</body></html>`}
function inject(){let sec=document.getElementById('s-paie');if(!sec||document.getElementById('mhRoadmapCard'))return;let c=document.createElement('div');c.id='mhRoadmapCard';c.className='card';c.innerHTML=`<h2>📄 Feuille de route hebdomadaire</h2><div class="al i" style="margin-bottom:9px">Feuille individuelle transport sanitaire A4. Le bouton ouvre l’impression Android : choisis <b>Enregistrer au format PDF</b>.</div><div class="g2"><div><label>Semaine du lundi</label><input type=date id=mhRoadmapDate></div><div><label>Document</label><button class=g id=mhRoadmapPdf style="width:100%">📄 Générer le PDF</button></div></div><div class=mut style="margin-top:8px">Les pauses utilisent le lieu ENT / DOM / EXT déjà enregistré dans la saisie.</div>`;let a=document.getElementById('pAlign')?.parentElement;sec.insertBefore(c,a?a.nextSibling:sec.firstChild);let i=document.getElementById('mhRoadmapDate');i.value=mon((DB.per&&DB.per.start)||today());i.onchange=()=>i.value=mon(i.value);document.getElementById('mhRoadmapPdf').onclick=()=>{let s=mon(i.value||today()),h=make(s);if(window.MesHeuresAndroid?.printHtml)MesHeuresAndroid.printHtml(h);else{let w=window.open('','_blank');if(!w){alert('Aperçu indisponible');return}w.document.write(h);w.document.close();setTimeout(()=>w.print(),250)}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{inject();setTimeout(inject,700)}, {once:true});else{inject();setTimeout(inject,700)}
window.MHRoadmap={generate:s=>make(mon(s||today()))};
})();
