/* MesHeures V23 — new cockpit, timeline analytics and tactile navigation. */
(function(){
  'use strict';
  const V='23.0.0';
  const PAGES=['home','jour','mois','paie','analyse'];
  let touchX=null,touchY=null,touchTarget=null;
  let fresh=!!window.MH_V23_FRESH;
  const $=id=>document.getElementById(id);
  const esc0=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtMin=m=>{m=Math.max(0,Math.round(Number(m)||0));return `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`};
  const shortDate=k=>k?new Date(k+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
  const todayKey=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
  const validKeys=()=>Object.keys(DB?.days||{}).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const pastKeys=()=>validKeys().filter(k=>k<=todayKey());

  function activeIndex(){const t=typeof curTab==='string'?curTab:'home';return PAGES.indexOf(t)}
  function setDots(){const d=$('mhV23Dots');if(!d)return;const i=activeIndex();[...d.children].forEach((x,n)=>x.classList.toggle('on',n===i));}
  function setNav(){const n=$('mhV17Nav');if(!n)return;const i=activeIndex();[...n.querySelectorAll('button')].forEach((b,j)=>b.classList.toggle('v23-active',j===i));setDots();}

  function ensureAnalysis(){
    if($('s-analyse'))return;
    const main=document.querySelector('main'); if(!main)return;
    const sec=document.createElement('section');sec.id='s-analyse';
    sec.innerHTML=`
      <div class="v23-hero">
        <div><span class="v23-eyebrow">MESHEURES · ANALYSE</span><h2>Centre de pilotage</h2><p>Une lecture rapide de votre activité réelle, de vos tendances et des journées qui méritent votre attention.</p></div>
        <div class="v23-range" id="v23Range">—</div>
      </div>
      <div class="v23-kpis" id="v23Kpis"></div>
      <div class="v23-grid2">
        <div class="card v23-card"><div class="v23-cardhead"><h2>📈 Tendance</h2><span class="period-pill">8 semaines</span></div><div id="v23Trend"></div></div>
        <div class="card v23-card"><div class="v23-cardhead"><h2>🧭 Comparaison</h2><span class="period-pill">2 × 14 jours</span></div><div id="v23Compare"></div></div>
      </div>
      <div class="card v23-card"><div class="v23-cardhead"><h2>🕒 Chronologie</h2><div class="row"><button class="g v23-filter on" data-filter="all">Tout</button><button class="g v23-filter" data-filter="alert">Alertes</button><button class="g v23-filter" data-filter="long">Longues</button></div></div><div id="v23Timeline"></div></div>
      <div class="v23-grid2">
        <div class="card v23-card"><div class="v23-cardhead"><h2>🏆 Repères</h2></div><div id="v23Records"></div></div>
        <div class="card v23-card"><div class="v23-cardhead"><h2>⚠️ Attention</h2></div><div id="v23Attention"></div></div>
      </div>`;
    main.insertBefore(sec,main.querySelector('#s-audit'));
    sec.querySelectorAll('.v23-filter').forEach(b=>b.addEventListener('click',()=>{
      sec.querySelectorAll('.v23-filter').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderTimeline(b.dataset.filter);
    }));
  }

  function patchTab(){
    if(window.__mhV23TabPatched)return;
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
    window.__mhV23TabPatched=true;
  }
  function animatePage(){const s=$('s-'+curTab);if(!s)return;s.classList.remove('mh-v23-page-in');void s.offsetWidth;s.classList.add('mh-v23-page-in');}
  function buildNav(){
    const n=$('mhV17Nav');if(n){n.innerHTML='<button onclick="tab(\'home\')">⌂<span>Accueil</span></button><button onclick="tab(\'jour\')">＋<span>Saisie</span></button><button onclick="tab(\'mois\')">▣<span>Planning</span></button><button onclick="tab(\'paie\')">€<span>Paie</span></button><button onclick="tab(\'analyse\')">◔<span>Analyse</span></button>';}
    if(!$('mhV23Dots')){const d=document.createElement('div');d.id='mhV23Dots';d.className='mh-v23-nav-state';PAGES.forEach(()=>d.appendChild(document.createElement('i')));document.body.appendChild(d)}
    setNav();
  }
  function patchTouch(){
    if(window.__mhV23Touch)return;window.__mhV23Touch=true;
    document.addEventListener('touchstart',e=>{const t=e.touches[0];if(!t)return;touchX=t.clientX;touchY=t.clientY;touchTarget=e.target},{passive:true,capture:true});
    document.addEventListener('touchend',e=>{
      if(touchX===null||!e.changedTouches[0])return;
      const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY,target=touchTarget;
      touchX=touchY=null;
      if(Math.abs(dx)<75||Math.abs(dx)<Math.abs(dy)*1.25)return;
      if(target?.closest?.('input,textarea,select,button,a,[contenteditable="true"],.modal-bg'))return;
      const i=activeIndex();if(i<0)return;const ni=Math.max(0,Math.min(PAGES.length-1,i+(dx<0?1:-1)));if(ni===i)return;
      e.preventDefault();e.stopImmediatePropagation();window.tab(PAGES[ni]);
    },{passive:false,capture:true});
  }

  function loadLatestDefault(){
    if(!fresh)return;
    fetch('./data/mesheures-default-backup.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(raw=>{
      const data=raw?.format==='MesHeures Backup'?raw.data:raw,days=data?.days||{},keys=Object.keys(days).sort();
      if(keys[0]!=='2025-05-19')throw new Error('Historique incomplet');
      DB={s:{...DEF,...(data.s||{}),appVersion:V},days:{...days},cmp:{...(data.cmp||{})},periods:Array.isArray(data.periods)?data.periods:[],bul:{...(data.bul||{})},bulletins:Array.isArray(data.bulletins)?data.bulletins:[],romi:{...(data.romi||{})},per:{start:'2025-05-19',nb:1,...(data.per||{})},exp:data.exp??null,constats:Array.isArray(data.constats)?data.constats:[],events:Array.isArray(data.events)?data.events:[],reconciliation:Array.isArray(data.reconciliation)?data.reconciliation:[]};
      DB.s.anchor='2025-05-19';save();curDate=today();curMonth=curDate.slice(0,7);renderAll();fresh=false;localStorage.setItem('mesheures_v3','1');
    }).catch(e=>console.warn('V23 archive indisponible',e));
  }

  function dayMetrics(k){try{return window.mhCalcDay?window.mhCalcDay(k):cd(k)}catch(e){return {tte:0,amp:0,pz:0,al:[]}}}
  function renderAnalysis(){
    ensureAnalysis();const keys=pastKeys(), worked=keys.filter(k=>{const d=DB.days[k];return d&&(d.t==='T'||d.t==='NUIT')});
    const rows=worked.map(k=>({k,d:DB.days[k],r:dayMetrics(k)})).filter(x=>x.r);
    const total=rows.reduce((s,x)=>s+(x.r.tte||0),0),avg=rows.length?total/rows.length:0,amp=rows.length?rows.reduce((s,x)=>s+(x.r.amp||0),0)/rows.length:0,alerts=rows.reduce((s,x)=>s+(x.r.al?.length||0),0);
    const first=keys[0],last=keys[keys.length-1];$('v23Range').textContent=first&&last?`${shortDate(first)} → ${shortDate(last)} · ${keys.length} journées enregistrées`:'Aucune donnée';
    $('v23Kpis').innerHTML=[['Journées',rows.length,'enregistrées'],['TTE total',fmtMin(total),'depuis le début'],['Moyenne',fmtMin(avg),'par journée travaillée'],['Amplitude Ø',fmtMin(amp),'par journée'],['Points',alerts,'à examiner']].map((x,i)=>`<div class="v23-kpi ${i===4&&alerts?'warn':''}"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');
    renderTrend(rows);renderCompare(rows);renderTimeline('all');renderRecords(rows);renderAttention(rows);
  }
  function renderTrend(rows){
    const weeks=[];const end=new Date(todayKey()+'T12:00:00');for(let i=7;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i*7);const start=new Date(d);start.setDate(start.getDate()-6);const a=start.toISOString().slice(0,10),b=d.toISOString().slice(0,10),rs=rows.filter(x=>x.k>=a&&x.k<=b),m=rs.reduce((s,x)=>s+x.r.tte,0);weeks.push({m,n:rs.length,label:d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})})}
    const max=Math.max(1,...weeks.map(x=>x.m));$('v23Trend').innerHTML=`<div class="v23-bars">${weeks.map(w=>`<div class="v23-barcol"><span>${fmtMin(w.m)}</span><i style="height:${Math.max(3,w.m/max*100)}%"></i><small>${w.label}</small></div>`).join('')}</div><div class="mut">Total hebdomadaire affiché sur les journées réellement enregistrées jusqu'à aujourd'hui.</div>`;
  }
  function renderCompare(rows){
    const end=todayKey(),a=[];for(let i=0;i<28;i++){const d=new Date(end+'T12:00:00');d.setDate(d.getDate()-i);a.push(d.toISOString().slice(0,10))}const cur=new Set(a.slice(0,14)),prev=new Set(a.slice(14));
    const sum=s=>rows.filter(x=>s.has(x.k)).reduce((o,x)=>(o.t+=x.r.tte,o.n++,o),{t:0,n:0});const c=sum(cur),p=sum(prev),delta=c.t-p.t;
    $('v23Compare').innerHTML=`<div class="v23-compare"><div><span>Derniers 14 jours</span><b>${fmtMin(c.t)}</b><small>${c.n} journées</small></div><div><span>14 jours précédents</span><b>${fmtMin(p.t)}</b><small>${p.n} journées</small></div></div><div class="v23-delta ${delta>=0?'up':'down'}">${delta===0?'→ Même volume':`${delta>0?'↑':'↓'} ${fmtMin(Math.abs(delta))} vs période précédente`}</div>`;
  }
  function renderTimeline(filter){
    const rows=pastKeys().map(k=>({k,d:DB.days[k],r:dayMetrics(k)})).filter(x=>x.d&&(x.d.t==='T'||x.d.t==='NUIT')).sort((a,b)=>b.k.localeCompare(a.k));
    let f=rows;if(filter==='alert')f=rows.filter(x=>x.r.al?.length);if(filter==='long')f=rows.filter(x=>x.r.tte>=660);f=f.slice(0,24);
    $('v23Timeline').innerHTML=f.length?f.map(x=>`<button class="v23-timeline-row" onclick="curDate='${x.k}';curMonth='${x.k.slice(0,7)}';tab('jour')"><span class="v23-dot ${x.r.al?.length?'bad':'ok'}"></span><strong>${shortDate(x.k)}</strong><span>${x.d.t==='NUIT'?'Nuit':'Travail'}</span><b>${fmtMin(x.r.tte)}</b><em>${x.r.al?.length?'⚠️ '+x.r.al.length:'✓'}</em></button>`).join(''):'<div class="mut">Aucune journée correspondant au filtre.</div>';
  }
  function renderRecords(rows){
    if(!rows.length){$('v23Records').innerHTML='<div class="mut">Pas encore de journée travaillée.</div>';return}
    const longest=[...rows].sort((a,b)=>b.r.tte-a.r.tte)[0],shortest=[...rows].sort((a,b)=>a.r.tte-b.r.tte)[0],night=rows.filter(x=>x.r.nuit>0).length;
    $('v23Records').innerHTML=`<div class="v23-record"><span>Journée la plus longue</span><b>${fmtMin(longest.r.tte)}</b><button class="g" onclick="curDate='${longest.k}';tab('jour')">${shortDate(longest.k)} →</button></div><div class="v23-record"><span>Journée la plus courte</span><b>${fmtMin(shortest.r.tte)}</b><button class="g" onclick="curDate='${shortest.k}';tab('jour')">${shortDate(shortest.k)} →</button></div><div class="v23-record"><span>Journées avec heures de nuit</span><b>${night}</b></div>`;
  }
  function renderAttention(rows){
    const al=rows.filter(x=>x.r.al?.length).sort((a,b)=>(b.r.al.length-a.r.al.length)||b.k.localeCompare(a.k)).slice(0,6);
    $('v23Attention').innerHTML=al.length?al.map(x=>`<button class="v23-attention" onclick="curDate='${x.k}';tab('jour')"><span>${shortDate(x.k)}</span><b>${x.r.al.length} point${x.r.al.length>1?'s':''}</b><small>${esc0(x.r.al[0].m||'À vérifier')}</small> →</button>`).join(''):'<div class="v23-clear">✓ Aucun point signalé sur les journées affichées.</div>';
  }

  function boot(){
    ensureAnalysis();patchTab();buildNav();patchTouch();
    const v=$('mhVersion');if(v)v.textContent='V23.0.0';
    const title=document.querySelector('.dash-greeting');if(title)title.textContent='Tableau de bord';
    const hs=$('homeBackupStatus');if(hs){hs.textContent='';hs.style.display='none'}
    document.title='MesHeures V23.0.0';
    setTimeout(()=>{setNav();loadLatestDefault()},40);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
