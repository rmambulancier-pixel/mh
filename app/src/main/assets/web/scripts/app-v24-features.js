/* MesHeures V24 — operational extensions: proactive alerts, live timer, structured OCR, CPH and TPU. */
(function(){
'use strict';
const esc0=window.esc||((s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const fmt=m=>{m=Math.max(0,Math.round(Number(m||0)));return Math.floor(m/60)+'h'+String(m%60).padStart(2,'0')};
const V='24.2.0', WEEK48=2880, AVG46=2760, REST11=660;
const work=k=>['T','NUIT'].includes(DB.days?.[k]?.t);
const calc=k=>{try{return window.mhCalcDay?window.mhCalcDay(k):cd(k)}catch{return {tte:0,amp:0,deb:null,fin:null,al:[],trav:0}}};
const mins=k=>Math.max(0,Number(calc(k).tte)||0);
const amp=k=>Math.max(0,Number(calc(k).amp)||0);
const eachDay=(a,b)=>{const o=[];for(let k=a;k<=b;k=addD(k,1))o.push(k);return o};

function scan(){
  const now=today(), issues=[];
  /* Every known/planned day in the next 12 weeks is included. */
  for(let wi=0;wi<12;wi++){
    const w=addD(mono(now),wi*7),e=addD(w,6);let total=0,known=0;
    for(const k of eachDay(w,e)){if(k<=now||DB.days?.[k]){total+=mins(k);known++}}
    if(!known)continue;
    if(total>WEEK48)issues.push({id:'48-'+w,lvl:'bad',title:wi?'Dépassement hebdomadaire planifié':'Dépassement hebdomadaire',text:`${wi?'Semaine du '+w.split('-').reverse().join('/'):'Cette semaine'} : ${fmt(total)} de TTE, soit ${fmt(total-WEEK48)} au-dessus de 48 h.`,rule:'CCN transport sanitaire art. 4'});
    else if(w===mono(now)&&total>=45*60)issues.push({id:'48w-'+w,lvl:'warn',title:'Semaine proche de 48 h',text:`${fmt(total)} déjà planifiées/constatées · marge ${fmt(WEEK48-total)}.`,rule:'CCN transport sanitaire art. 4'});
  }
  /* Daily rest: only warn when both adjacent shifts are sufficiently long for the 11 h rule to apply. */
  let prev=null;
  for(const k of eachDay(addD(now,-14),addD(now,83))){
    if(!work(k))continue;const r=calc(k);if(r.deb==null||r.fin==null)continue;
    if(prev&&nDays(prev.k,k)===1){const gap=1440+Number(r.deb)-Number(prev.fin);if(gap<REST11&&(amp(prev.k)>720||amp(k)>720))issues.push({id:'rest-'+k,lvl:'bad',title:'Repos quotidien < 11 h',text:`${fmt(gap)} entre ${prev.k.split('-').reverse().join('/')} et ${k.split('-').reverse().join('/')}.`,rule:'CCN transport sanitaire art. 7'});}
    prev={k,fin:r.fin};
  }
  /* Rolling 12-week known-data window. This is an early warning, not a claim about unplanned work. */
  const start=addD(now,-83), end=addD(now,83), weeks=[];
  for(let w=mono(start);w<=mono(end);w=addD(w,7))weeks.push(w);
  for(let i=0;i<=weeks.length-12;i++){const slice=weeks.slice(i,i+12);let total=0,known=0;for(const w of slice)for(const k of eachDay(w,addD(w,6))){if(k<=now||DB.days?.[k]){total+=mins(k);known++}} if(!known)continue;const avg=total/12;if(avg>AVG46){issues.push({id:'46-'+slice[0],lvl:'bad',title:'Fenêtre 12 semaines au-dessus de 46 h',text:`Données actuellement connues : ${fmt(avg)} de moyenne hebdomadaire.`,rule:'CCN transport sanitaire art. 4'});break}}
  return issues;
}
function renderProactive(){
  ['mhV24Proactive','mhV24HomeProactive'].forEach(id=>{const h=document.getElementById(id);if(!h)return;const a=scan();h.innerHTML=a.length?a.slice(0,5).map(x=>`<div class="mh-v24m-issue ${x.lvl}"><b>${x.lvl==='bad'?'🔴':'🟠'} ${esc0(x.title)}</b><small>${esc0(x.text)}</small><em>${esc0(x.rule)}</em></div>`).join(''):'<div class="mh-v24m-ok">🟢 Aucun dépassement prévisible dans les données actuellement saisies.</div>'});
}
let lastToast='';function notify(){const a=scan();if(!a.length)return;const key=a.map(x=>x.id).join('|');if(key===lastToast)return;lastToast=key;let t=document.getElementById('mhV24Toast');if(!t){t=document.createElement('div');t.id='mhV24Toast';document.body.appendChild(t)}t.className='mh-v24m-toast '+(a.some(x=>x.lvl==='bad')?'bad':'warn');t.textContent=a[0].title+' — '+a[0].text;t.classList.add('on');clearTimeout(notify.t);notify.t=setTimeout(()=>t.classList.remove('on'),4500)}

function nowHHMM(){const d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes())}
function elapsed(k){const d=DB.days?.[k];if(!d?.running||!d.deb)return 0;if(d.startEpoch)return Math.max(0,Math.floor((Date.now()-Number(d.startEpoch))/60000));const a=P(d.deb),b=P(nowHHMM());return a==null||b==null?0:Math.max(0,b-a)}
function startTimer(){if(curDate!==today())return alert('Le chronomètre est disponible uniquement pour aujourd’hui.');const d=gd(curDate);d.t='T';d.deb=nowHHMM();d.fin=null;d.startEpoch=Date.now();d.running=true;save();renderDay();refresh();notify()}
function stopTimer(){const d=gd(curDate);if(!d.running)return;d.fin=nowHHMM();d.running=false;d.endEpoch=Date.now();save();renderDay();refresh();notify()}
function renderTimer(){const h=document.getElementById('mhV24Timer');if(!h)return;const d=DB.days?.[curDate];if(!d||d.t!=='T'){h.innerHTML='';return}if(d.running){h.innerHTML=`<div class="mh-v24m-live"><span class="pulse"></span><div><b>EN SERVICE</b><strong id="mhV24Elapsed">${fmt(elapsed(curDate))}</strong><small>Début ${esc0(d.deb||'—')} · comptage automatique</small></div><button class="danger-soft" onclick="mhV24StopTimer()">⏹ Arrêter</button></div>`}else if(d.deb&&!d.fin){h.innerHTML=`<div class="mh-v24m-live pending"><div><b>Journée ouverte</b><strong>${fmt(elapsed(curDate))}</strong><small>Début ${esc0(d.deb)}</small></div><button onclick="mhV24StartTimer()">▶ Reprendre</button></div>`}else h.innerHTML='<button class="mh-v24m-start" onclick="mhV24StartTimer()">▶ Démarrer le chronomètre</button>'}

function tpu(){let u=0,m=0,n=0;for(const k of Object.keys(DB.days||{}).sort())if(work(k)){u+=mins(k);m+=amp(k);n++}return {u,m,p:m?u/m*100:0,n}}
function renderTPU(){const x=tpu();document.querySelectorAll('[data-mh-v24m-tpu]').forEach(h=>h.innerHTML=`<div class="mh-v24m-tpu-main"><strong>${x.p.toFixed(1)} %</strong><span>TTE / temps mobilisé</span></div><div class="mut">${fmt(x.u)} utiles · ${fmt(x.m)} mobilisées · ${x.n} journées.</div><small class="mut">Indicateur personnel expérimental, pas une mesure réglementaire.</small>`)}

function structured(text){const lines=String(text||'').replace(/\u00a0/g,' ').split(/\n+/).map(x=>x.trim()).filter(Boolean),o={hs25:null,hs50:null,dim:null,iru:null,ir:null,brut:null,net:null,month:null};const mn={janvier:'01',février:'02',fevrier:'02',mars:'03',avril:'04',mai:'05',juin:'06',juillet:'07',août:'08',aout:'08',septembre:'09',octobre:'10',novembre:'11',décembre:'12',decembre:'12'};for(const l of lines){let x=l.match(/[Pp][ée]riode\s*:?\s*([A-Za-zÀ-ÿ]+)\s+(\d{4})/);if(x&&mn[x[1].toLowerCase()])o.month=x[2]+'-'+mn[x[1].toLowerCase()];const ns=typeof numsOfLine==='function'?numsOfLine(l):[];if(/suppl[ée]?mentaires?\s*25\s*%?/i.test(l)&&ns.length)o.hs25={h:ns[0],amount:ns.length>2?ns[ns.length-1]:null};if(/suppl[ée]?mentaires?\s*50\s*%?/i.test(l)&&ns.length)o.hs50={h:ns[0],amount:ns.length>2?ns[ns.length-1]:null};if(/dimanche|jour f[ée]ri[ée]/i.test(l)&&ns.length)o.dim=ns[ns.length-1];if(/^salaire\s+brut/i.test(l)&&ns.length)o.brut=ns[ns.length-1];if(/^net\s+(?:[àa]\s+payer|pay[ée])/i.test(l)&&ns.length)o.net=ns[ns.length-1]};return o}
function calcMonth(month){
 if(!/^\d{4}-\d{2}$/.test(month||''))return null;
 const [yr,mo]=month.split('-').map(Number),first=month+'-01',last=isoOf(new Date(yr,mo,0));
 let calcH25=0,calcH50=0,calcDim=0,cur=first;
 while(cur<=last){const r=calc(cur);if(r.dim&&r.trav)calcDim++;cur=addD(cur,1)}
 const anchor=DB.s?.anchor||'2025-05-19';const diffFirst=nDays(anchor,first);let qStart=addD(anchor,Math.floor(diffFirst/14)*14);if(qStart>first)qStart=addD(qStart,-14);
 for(let qc=qStart;qc<=last;qc=addD(qc,14)){
   const qe=addD(qc,13);if(qe<first)continue;const o=calcPer(qc,1).Q[0];const os=qc<first?first:qc,oe=qe>last?last:qe;
   const totalDays=nDays(qc,qe)+1,overlap=nDays(os,oe)+1,ratio=overlap/totalDays;
   calcH25+=o.h25*ratio;calcH50+=o.h50*ratio;if(nDays(qStart,qc)>90)break;
 }
 return {hs25:calcH25/60,hs50:calcH50/60,dim:calcDim};
}
function renderOCR(text,host){const d=structured(text),c=calcMonth(d.month),rows=[];const add=(l,o,x,u)=>{if(o==null&&x==null)return;const delta=o==null||x==null?null:Number(o)-Number(x);rows.push(`<tr><td>${l}</td><td>${o==null?'—':o+u}</td><td>${x==null?'—':x+u}</td><td class="${delta!=null&&Math.abs(delta)>.01?'bad':'ok'}">${delta==null?'—':(delta>0?'+':'')+delta.toFixed(2)+u}</td></tr>`)};add('HS 25 %',d.hs25?.h,c?.hs25,' h');add('HS 50 %',d.hs50?.h,c?.hs50,' h');add('Dimanches / fériés',d.dim,c?.dim,'');host.innerHTML=`<div class="card mh-v24m-ocr-card"><div class="section-head"><h2>🔎 OCR structuré</h2><span class="period-pill">V24</span></div><div class="mut">Écart ligne à ligne entre le document OCR et les calculs MesHeures.</div>${d.month?`<div class="mh-v24m-ocr-month">Période : <b>${esc0(d.month)}</b></div>`:''}<table><tr><th>Ligne</th><th>Document</th><th>MesHeures</th><th>Écart</th></tr>${rows.join('')}</table><div class="mut" style="margin-top:8px">Brut : <b>${d.brut==null?'—':money(d.brut)}</b> · Net : <b>${d.net==null?'—':money(d.net)}</b></div></div>`}
function money(n){return Number.isFinite(Number(n))?Number(n).toFixed(2).replace('.',',')+' €':'—'}
async function ocrBulletin(file){if(!file)return;const out=$('bulOut');try{out.innerHTML='<div class="al i">⏳ OCR structuré du bulletin…</div>';const w=await getTessWorker();const pdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name),src=pdf?await pdfPageImages(file):[file];let text='';for(const x of src)text+=(await w.recognize(x)).data.text+'\n';$('bulTxt').value=text;parseBulletin();renderOCR(text,$('mhV24BulOCR'));out.innerHTML='<div class="al k">✅ OCR structuré terminé. Vérifie les écarts avant toute conclusion.</div>'}catch(e){out.innerHTML='<div class="al b">❌ OCR : '+esc0(e.message)+'</div>'}finally{$('mhV24BulFile').value=''}}
function cphRows(){const a=DB.s?.anchor||'2025-05-19',keys=Object.keys(DB.days||{}).sort(),out=[];if(!keys.length)return out;for(let s=a;s<=keys[keys.length-1];s=addD(s,14)){const e=addD(s,13);if(e<keys[0])continue;const q=calcPer(s,1).Q[0];const an=[];for(const k of eachDay(s,e))(calc(k).al||[]).forEach(x=>an.push({k,...x}));out.push({s,e,tte:q?.seuil||0,amp:q?.amp||0,h25:q?.h25||0,h50:q?.h50||0,work:q?.trav||0,an})}return out}
function cphHtml(rows,hash){return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>MesHeures — Pièce CPH</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#111}h1{font-size:22px}h2{font-size:16px;border-bottom:1px solid #aaa;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #bbb;padding:5px;vertical-align:top}th{background:#eee}.box{border:1px solid #aaa;padding:10px;margin:10px 0}.hash{font:9px monospace;word-break:break-all}</style></head><body><h1>MesHeures — Synthèse par quatorzaine</h1><p>Document de travail destiné à une production au Conseil de prud'hommes · V${V}</p><div class="box"><b>Période :</b> ${rows[0]?.s||''} → ${rows.at(-1)?.e||''}<br><b>CCN :</b> ${esc0(window.MH_LEGAL?.ccn||'CCN transport sanitaire')}<br><b>Accord :</b> ${esc0(window.MH_LEGAL?.transportSanitaire||'Accord du 16 juin 2016')}</div><table><tr><th>Quatorzaine</th><th>Jours</th><th>TTE</th><th>Amplitude</th><th>HS25</th><th>HS50</th><th>Constats</th></tr>${rows.map(r=>`<tr><td>${r.s} → ${r.e}</td><td>${r.work}</td><td>${fmt(r.tte)}</td><td>${fmt(r.amp)}</td><td>${fmt(r.h25)}</td><td>${fmt(r.h50)}</td><td>${r.an.length}</td></tr>`).join('')}</table><h2>Renvois</h2><ul><li>Pause : ${esc0(window.MH_LEGAL?.rules?.pause20?.source||'Code du travail, art. L3121-16')}</li><li>Amplitude : ${esc0(window.MH_LEGAL?.rules?.ampMax?.source||'Accord transport sanitaire, art. 3')}</li><li>Durée hebdomadaire : ${esc0(window.MH_LEGAL?.rules?.weeklyMax?.source||'Accord transport sanitaire, art. 4')}</li><li>Repos quotidien : ${esc0(window.MH_LEGAL?.rules?.dailyRest?.source||'Accord transport sanitaire, art. 7')}</li></ul><h2>Empreinte</h2><div class="hash">SHA-256 : ${hash}</div><p>À confronter aux pièces originales, plannings, bulletins et règles applicables.</p></body></html>`}
async function exportCPH(){const rows=cphRows();if(!rows.length)return alert('Aucune journée enregistrée.');const hbuf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows))),hash=Array.from(new Uint8Array(hbuf)).map(b=>b.toString(16).padStart(2,'0')).join(''),html=cphHtml(rows,hash);if(window.MesHeuresAndroid?.printHtml){try{window.MesHeuresAndroid.printHtml(html);return}catch{}}const w=window.open('','_blank');if(!w)return alert('Autorise les fenêtres contextuelles.');w.document.write(html);w.document.close();setTimeout(()=>w.print(),500)}

function inject(){
  if(!document.getElementById('mhV24ExtraBlock')){
    const host=document.createElement('div');
    host.id='mhV24ExtraBlock';
    host.innerHTML=`<div class="card"><div class="section-head"><h2>🛡️ Alerte proactive</h2><span class="period-pill">temps réel</span></div><div id="mhV24Proactive"></div></div><div class="card"><div class="section-head"><h2>📐 Taux de Présence Utile</h2><span class="period-pill">personnel</span></div><div data-mh-v24m-tpu></div></div><div class="card"><div class="section-head"><h2>⚖️ Pièce CPH</h2><span class="period-pill">1 clic</span></div><p class="mut">Synthèse par quatorzaine avec renvois aux articles du référentiel MesHeures et empreinte SHA-256.</p><button onclick="mhV24ExportCPH()" style="width:100%">📄 Générer la pièce CPH</button></div>`;
    const target=document.getElementById('s-analyse')||document.getElementById('s-audit')||document.querySelector('main');
    if(target)target.appendChild(host);
  }
  if(!document.getElementById('mhV24Timer')){
    const h=document.createElement('div');h.id='mhV24Timer';
    const j=document.getElementById('s-jour');if(j)j.insertBefore(h,j.querySelector('.card'));
  }
  if(!document.getElementById('mhV24BulFile')){
    const bul=document.getElementById('s-bul'),c=bul?.querySelector('.card');
    if(c){
      const b=document.createElement('div');b.className='card';
      b.innerHTML=`<div class="section-head"><h2>🔎 OCR bulletin scanné</h2><span class="period-pill">structuré</span></div><p class="mut">Pour les bulletins image/scannés : extraction OCR puis rapprochement des lignes sensibles.</p><button class="g" style="width:100%" onclick="document.getElementById('mhV24BulFile').click()">📎 Scanner le PDF</button><input id="mhV24BulFile" type="file" accept=".pdf,application/pdf,image/*" style="display:none" onchange="mhV24OCRBulletin(this.files[0])"><div id="mhV24BulOCR" style="margin-top:9px"></div>`;
      c.after(b);
    }
  }
  if(!document.getElementById('mhV24HomeProactive')){
    const home=document.getElementById('s-home');
    if(home){
      const c=document.createElement('div');c.className='card';c.id='mhV24Home';
      c.innerHTML=`<div class="section-head"><h2>🛡️ Anticipation</h2><button class="text-action" onclick="tab('analyse')">Voir ›</button></div><div id="mhV24HomeProactive"></div>`;
      home.appendChild(c);
    }
  }
}
function refresh(){renderProactive();renderTPU();renderTimer()}
function patch(name,after){const key='__mhV24_'+name;if(window[key]||typeof window[name]!=='function')return;const old=window[name];window[name]=function(){const r=old.apply(this,arguments);setTimeout(()=>{after();refresh();},0);return r};window[key]=true}
function boot(){inject();patch('setD',notify);patch('setP',notify);patch('addP',notify);patch('delP',notify);patch('clearDay',notify);patch('dupliConfirm',notify);patch('renderDay',()=>{});refresh();if(boot.timer)clearInterval(boot.timer);boot.timer=setInterval(()=>{renderTimer();if(DB.days?.[today()]?.running)pushWidgetData?.()},1000)}
window.mhV24StartTimer=startTimer;window.mhV24StopTimer=stopTimer;window.mhV24ExportCPH=exportCPH;window.mhV24OCRBulletin=ocrBulletin;window.mhV24ProactiveScan=scan;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
