/* MesHeures V24 — new cockpit, timeline analytics and tactile navigation. */
(function(){
  'use strict';
  const V='24.0.0';
  const PAGES=['home','jour','mois','paie','analyse'];
  let fresh=!!window.MH_V24_FRESH;
  const $=id=>document.getElementById(id);
  const esc0=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtMin=m=>{m=Math.max(0,Math.round(Number(m)||0));return `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`};
  const shortDate=k=>k?new Date(k+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
  const todayKey=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
  const validKeys=()=>Object.keys(window.DB?.days||{}).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const pastKeys=()=>validKeys().filter(k=>k<=todayKey());

  function activeIndex(){const t=typeof curTab==='string'?curTab:'home';return PAGES.indexOf(t)}
  function setDots(){const d=$('mhV24Dots');if(!d)return;const i=activeIndex();[...d.children].forEach((x,n)=>x.classList.toggle('on',n===i));}
  function setNav(){const n=$('mhV17Nav');if(!n)return;const i=activeIndex();[...n.querySelectorAll('button')].forEach((b,j)=>b.classList.toggle('v24m-active',j===i));setDots();}

  function ensureAnalysis(){
    if($('s-analyse'))return;
    const main=document.querySelector('main'); if(!main)return;
    const sec=document.createElement('section');sec.id='s-analyse';
    sec.innerHTML=`
      <div class="v24m-hero">
        <div><span class="v24m-eyebrow">MESHEURES · ANALYSE</span><h2>Centre de pilotage</h2><p>Une lecture rapide de votre activité réelle, de vos tendances et des journées qui méritent votre attention.</p></div>
        <div class="v24m-range" id="v24mRange">—</div>
      </div>
      <div class="v24m-kpis" id="v24mKpis"></div>
      <div class="v24m-grid2">
        <div class="card v24m-card"><div class="v24m-cardhead"><h2>📈 Tendance</h2><span class="period-pill">8 semaines</span></div><div id="v24mTrend"></div></div>
        <div class="card v24m-card"><div class="v24m-cardhead"><h2>🧭 Comparaison</h2><span class="period-pill">2 × 14 jours</span></div><div id="v24mCompare"></div></div>
      </div>
      <div class="card v24m-card"><div class="v24m-cardhead"><h2>🕒 Chronologie</h2><div class="row"><button class="g v24m-filter on" data-filter="all">Tout</button><button class="g v24m-filter" data-filter="alert">Alertes</button><button class="g v24m-filter" data-filter="long">Longues</button></div></div><div id="v24mTimeline"></div></div>
      <div class="v24m-grid2">
        <div class="card v24m-card"><div class="v24m-cardhead"><h2>🏆 Repères</h2></div><div id="v24mRecords"></div></div>
        <div class="card v24m-card"><div class="v24m-cardhead"><h2>⚠️ Attention</h2></div><div id="v24mAttention"></div></div>
      </div>`;
    main.insertBefore(sec,main.querySelector('#s-audit'));
    sec.querySelectorAll('.v24m-filter').forEach(b=>b.addEventListener('click',()=>{
      sec.querySelectorAll('.v24m-filter').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderTimeline(b.dataset.filter);
    }));
  }

  function patchTab(){
    if(window.__mhV24TabPatched)return;
    const original=window.tab;if(typeof original!=='function')return;
    window.tab=function(t){
      if(t==='analyse'){
        curTab='analyse';
        ['home','jour','mois','paie','audit','bul','romi','reg'].forEach(x=>{const s=$('s-'+x);if(s)s.classList.remove('on');const b=$('t-'+x);if(b)b.classList.remove('on')});
        const s=$('s-analyse');if(s)s.classList.add('on');
        window.scrollTo(0,0);ensureAnalysis();renderAnalysis();setNav();animatePage();return;
      }
      original(t);setNav();animatePage();
    };
    window.__mhV24TabPatched=true;
  }
  function animatePage(){const s=$('s-'+curTab);if(!s)return;s.classList.remove('mh-v24m-page-in');void s.offsetWidth;s.classList.add('mh-v24m-page-in');}
  function loadLatestDefault(){
    if(!fresh)return;
    fetch('./data/mesheures-default-backup.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(raw=>{
      const data=raw?.format==='MesHeures Backup'?raw.data:raw,days=data?.days||{},keys=Object.keys(days).sort();
      if(keys[0]!=='2025-05-19')throw new Error('Historique incomplet');
      DB={s:{...DEF,...(data.s||{}),appVersion:V},days:{...days},cmp:{...(data.cmp||{})},periods:Array.isArray(data.periods)?data.periods:[],bul:{...(data.bul||{})},bulletins:Array.isArray(data.bulletins)?data.bulletins:[],romi:{...(data.romi||{})},per:{start:'2025-05-19',nb:1,...(data.per||{})},exp:data.exp??null,constats:Array.isArray(data.constats)?data.constats:[],events:Array.isArray(data.events)?data.events:[],reconciliation:Array.isArray(data.reconciliation)?data.reconciliation:[]};
      DB.s.anchor='2025-05-19';save();curDate=today();curMonth=curDate.slice(0,7);renderAll();fresh=false;localStorage.setItem('mesheures_v3','1');
    }).catch(e=>console.warn('V24 archive indisponible',e));
  }

  function dayMetrics(k){try{return window.mhCalcDay?window.mhCalcDay(k):cd(k)}catch(e){return {tte:0,amp:0,pz:0,al:[]}}}
  function renderAnalysis(){
    ensureAnalysis();const keys=pastKeys(), worked=keys.filter(k=>{const d=DB.days[k];return d&&(d.t==='T'||d.t==='NUIT')});
    const rows=worked.map(k=>({k,d:DB.days[k],r:dayMetrics(k)})).filter(x=>x.r);
    const total=rows.reduce((s,x)=>s+(x.r.tte||0),0),avg=rows.length?total/rows.length:0,amp=rows.length?rows.reduce((s,x)=>s+(x.r.amp||0),0)/rows.length:0,alerts=rows.reduce((s,x)=>s+(x.r.al?.length||0),0);
    const first=keys[0],last=keys[keys.length-1];$('v24mRange').textContent=first&&last?`${shortDate(first)} → ${shortDate(last)} · ${keys.length} journées enregistrées`:'Aucune donnée';
    $('v24mKpis').innerHTML=[['Journées',rows.length,'enregistrées'],['TTE total',fmtMin(total),'depuis le début'],['Moyenne',fmtMin(avg),'par journée travaillée'],['Amplitude Ø',fmtMin(amp),'par journée'],['Points',alerts,'à examiner']].map((x,i)=>`<div class="v24m-kpi ${i===4&&alerts?'warn':''}"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');
    renderTrend(rows);renderCompare(rows);renderTimeline('all');renderRecords(rows);renderAttention(rows);
  }
  function renderTrend(rows){
    const weeks=[];const end=new Date(todayKey()+'T12:00:00');for(let i=7;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i*7);const start=new Date(d);start.setDate(start.getDate()-6);const a=start.toISOString().slice(0,10),b=d.toISOString().slice(0,10),rs=rows.filter(x=>x.k>=a&&x.k<=b),m=rs.reduce((s,x)=>s+x.r.tte,0);weeks.push({m,n:rs.length,label:d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})})}
    const max=Math.max(1,...weeks.map(x=>x.m));$('v24mTrend').innerHTML=`<div class="v24m-bars">${weeks.map(w=>`<div class="v24m-barcol"><span>${fmtMin(w.m)}</span><i style="height:${Math.max(3,w.m/max*100)}%"></i><small>${w.label}</small></div>`).join('')}</div><div class="mut">Total hebdomadaire affiché sur les journées réellement enregistrées jusqu'à aujourd'hui.</div>`;
  }
  function renderCompare(rows){
    const end=todayKey(),a=[];for(let i=0;i<28;i++){const d=new Date(end+'T12:00:00');d.setDate(d.getDate()-i);a.push(d.toISOString().slice(0,10))}const cur=new Set(a.slice(0,14)),prev=new Set(a.slice(14));
    const sum=s=>rows.filter(x=>s.has(x.k)).reduce((o,x)=>(o.t+=x.r.tte,o.n++,o),{t:0,n:0});const c=sum(cur),p=sum(prev),delta=c.t-p.t;
    $('v24mCompare').innerHTML=`<div class="v24m-compare"><div><span>Derniers 14 jours</span><b>${fmtMin(c.t)}</b><small>${c.n} journées</small></div><div><span>14 jours précédents</span><b>${fmtMin(p.t)}</b><small>${p.n} journées</small></div></div><div class="v24m-delta ${delta>=0?'up':'down'}">${delta===0?'→ Même volume':`${delta>0?'↑':'↓'} ${fmtMin(Math.abs(delta))} vs période précédente`}</div>`;
  }
  function renderTimeline(filter){
    const rows=pastKeys().map(k=>({k,d:DB.days[k],r:dayMetrics(k)})).filter(x=>x.d&&(x.d.t==='T'||x.d.t==='NUIT')).sort((a,b)=>b.k.localeCompare(a.k));
    let f=rows;if(filter==='alert')f=rows.filter(x=>x.r.al?.length);if(filter==='long')f=rows.filter(x=>x.r.tte>=660);f=f.slice(0,24);
    $('v24mTimeline').innerHTML=f.length?f.map(x=>`<button class="v24m-timeline-row" onclick="curDate='${x.k}';curMonth='${x.k.slice(0,7)}';tab('jour')"><span class="v24m-dot ${x.r.al?.length?'bad':'ok'}"></span><strong>${shortDate(x.k)}</strong><span>${x.d.t==='NUIT'?'Nuit':'Travail'}</span><b>${fmtMin(x.r.tte)}</b><em>${x.r.al?.length?'⚠️ '+x.r.al.length:'✓'}</em></button>`).join(''):'<div class="mut">Aucune journée correspondant au filtre.</div>';
  }
  function renderRecords(rows){
    if(!rows.length){$('v24mRecords').innerHTML='<div class="mut">Pas encore de journée travaillée.</div>';return}
    const longest=[...rows].sort((a,b)=>b.r.tte-a.r.tte)[0],shortest=[...rows].sort((a,b)=>a.r.tte-b.r.tte)[0],night=rows.filter(x=>x.r.nuit>0).length;
    $('v24mRecords').innerHTML=`<div class="v24m-record"><span>Journée la plus longue</span><b>${fmtMin(longest.r.tte)}</b><button class="g" onclick="curDate='${longest.k}';tab('jour')">${shortDate(longest.k)} →</button></div><div class="v24m-record"><span>Journée la plus courte</span><b>${fmtMin(shortest.r.tte)}</b><button class="g" onclick="curDate='${shortest.k}';tab('jour')">${shortDate(shortest.k)} →</button></div><div class="v24m-record"><span>Journées avec heures de nuit</span><b>${night}</b></div>`;
  }
  function renderAttention(rows){
    const al=rows.filter(x=>x.r.al?.length).sort((a,b)=>(b.r.al.length-a.r.al.length)||b.k.localeCompare(a.k)).slice(0,6);
    $('v24mAttention').innerHTML=al.length?al.map(x=>`<button class="v24m-attention" onclick="curDate='${x.k}';tab('jour')"><span>${shortDate(x.k)}</span><b>${x.r.al.length} point${x.r.al.length>1?'s':''}</b><small>${esc0(x.r.al[0].m||'À vérifier')}</small> →</button>`).join(''):'<div class="v24m-clear">✓ Aucun point signalé sur les journées affichées.</div>';
  }

  function boot(){
    ensureAnalysis();patchTab();
    // buildNav() et patchTouch() ont été retirés d'ici : app-v24.js (chargé juste après)
    // reconstruit le nav et pose SON propre swipe (pointer events, avec suivi du doigt).
    // Les garder ici créait deux gestionnaires de swipe actifs en même temps sur le même
    // geste (touchstart/touchend ici + pointerdown/pointermove/pointerup dans app-v24.js),
    // et deux constructions de nav en compétition sur le même id #mhV24Dots avec des
    // classes CSS différentes — la seconde (app-v24.js) trouvait l'élément déjà créé par
    // celle-ci et n'appliquait jamais son propre style.
    const v=$('mhVersion');if(v)v.textContent='V24.0.0';
    const title=document.querySelector('.dash-greeting');if(title)title.textContent='Tableau de bord';
    const hs=$('homeBackupStatus');if(hs){hs.textContent='';hs.style.display='none'}
    document.title='MesHeures V24.0.0';
    setTimeout(()=>{setNav();loadLatestDefault()},40);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
