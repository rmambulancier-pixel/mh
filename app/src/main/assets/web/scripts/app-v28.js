/* MesHeures V28 — Reactive Data Engine + ultra-fluid cockpit
 * V28 owns the runtime. Data is memoized, invalidated after mutations and
 * rendered incrementally. The restored home is intentionally the rich cockpit:
 * Intelligence -> Tableau de bord -> Live -> actions -> today -> quatorzaine.
/* MesHeures V28 — Data Engine + Render Scheduler
 * Goal: one canonical data pipeline, memoized derived metrics, and zero full
 * dashboard redraws for the live clock. Legacy UI remains the visual source.
 */
(function(){
  'use strict';
  const V='30.0.0';
  const SECTIONS=['home','jour','mois','paie','analyse','audit','bul','romi','reg'];
  const $=id=>document.getElementById(id);
  const esc0=s=>typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=m=>typeof F==='function'?F(Math.round(m||0)):'0h00';
  const money=n=>typeof EUR==='function'?EUR(n):'—';

  /* ---------- V28 Data Engine ---------- */
  const dayCache=new Map(), monthCache=new Map(), periodCache=new Map();
  let generation=0;
  const engine={
    version:V,
    day(k){
      k=k||today(); const hit=dayCache.get(k); if(hit&&hit.g===generation)return hit.v;
      const v=typeof cd==='function'?cd(k):{}; dayCache.set(k,{g:generation,v}); return v;
    },
    month(ym){
      ym=ym||today().slice(0,7); const hit=monthCache.get(ym); if(hit&&hit.g===generation)return hit.v;
      const [y,m]=ym.split('-').map(Number),last=isoOf(new Date(y,m,0));
      const out={amp:0,tte:0,trav:0,ir:0,iru:0,idaj:0,nuit:0,fer:0,dim:0,alerts:[],hard:0,warn:0,days:0};
      for(let k=ym+'-01';k<=last;k=addD(k,1)){
        const r=this.day(k),d=DB.days?.[k]; if(d)out.days++;
        out.amp+=r.amp||0;out.tte+=r.tte||0;out.trav+=r.trav||0;out.ir+=r.ir||0;out.iru+=r.iru||0;out.idaj+=r.idaj||0;out.nuit+=r.nuit||0;out.fer+=r.fer||0;out.dim+=r.dim||0;
        (r.al||[]).forEach(a=>{out.alerts.push({k,...a});a.lvl==='b'?out.hard++:out.warn++});
      }
      monthCache.set(ym,{g:generation,v:out}); return out;
    },
    period(qs,nb=1){
      const key=qs+'|'+nb,hit=periodCache.get(key); if(hit&&hit.g===generation)return hit.v;
      const v=typeof calcPer==='function'?calcPer(qs,nb):{Q:[],G:{}}; periodCache.set(key,{g:generation,v}); return v;
    },
    invalidate(reason='state'){generation++;dayCache.clear();monthCache.clear();periodCache.clear();window.dispatchEvent(new CustomEvent('mh28:invalidated',{detail:{reason,generation}}));},
    stats(){return {generation,days:dayCache.size,months:monthCache.size,periods:periodCache.size};}
  };
  window.MH28DataEngine=engine;

  /* V30: one render gateway. Legacy call sites never invoke renderAll directly. */
  window.mhRefresh=function(reason){
    try{
      if(window.MH28 && typeof window.MH28.refresh==='function') return window.MH28.refresh(reason||'mutation');
      if(typeof window.renderAll==='function') return window.renderAll();
    }catch(e){console.warn('MesHeures V30 refresh',e)}
  };


  /* Wrap the single mutation gateway so every save invalidates derived data. */
  function patchSave(){
    if(window.__mh28SavePatch||typeof window.save!=='function')return;
    const base=window.save;
    window.save=function(){
      const out=base.apply(this,arguments);
      engine.invalidate('save');
      schedule('save');
      return out;
    };
    window.__mh28SavePatch=true;
  }

  let raf=0,liveTimer=0,booted=false,activeStructure='';
  let dirty=new Set(['home']);
  function safe(fn,label){try{return typeof fn==='function'?fn():null}catch(e){console.warn('MesHeures V28 '+label,e);return null}}
  function schedule(reason){
    if(reason)dirty.add(window.curTab||'home');
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=0;renderActive()});
  }

  function periodInfo(){
    const k=today(),diff=nDays(DB.s.anchor,k),qs=addD(DB.s.anchor,Math.floor(diff/14)*14);
    const qd=engine.period(qs,1),q=qd.Q?.[0]||{},N=(DB.s.base||0)*120,pc=N?Math.min(100,(q.seuil||0)/N*100):0;
    return {qs,q,N,pc,qG:qd.G||{}};
  }

  function intelligenceHtml(){
    let intel=null; try{intel=window.mhV18IntelligenceData?.()}catch(e){}
    const p=intel?.projection||{}, patterns=intel?.patterns||[];
    const avg=p.avg||0, margin=p.margin||0, projected=p.projectedAvg||0;
    const cls=margin<0?'bad':projected>(typeof LEGAL_WEEK==='number'?LEGAL_WEEK:2760)?'bad':p.unknownDays?'warn':'ok';
    return `<div class="card mh-v18-intel mh28-intelligence" id="mh28Intel">
      <h2>🧠 Intelligence <span class="sub">analyse locale</span></h2>
      <div class="mh-v18-kpis"><div><b>${fmt(Math.round(avg))}</b><span>moyenne actuelle / semaine</span></div><div><b class="${cls}">${fmt(Math.round(margin))}</b><span>marge avant 46 h</span></div><div><b>${fmt(Math.round(projected))}</b><span>trajectoire simulée</span></div></div>
      <div class="mh-v18-intel-bar"><i style="width:${Math.min(100,Math.max(0,avg/(typeof LEGAL_WEEK==='number'?LEGAL_WEEK:2760)*100)).toFixed(1)}%"></i></div>
      <div class="mh-v18-intel-note">12 semaines glissantes · ${p.plannedDays||0} journée(s) future(s) planifiée(s) · ${p.unknownDays||0} journée(s) future(s) inconnue(s).${p.firstRisk?` ⚠️ Risque détecté vers le ${typeof shortY==='function'?shortY(p.firstRisk):p.firstRisk}.`:' Aucun dépassement projeté sur les journées futures connues.'}</div>
      ${p.unknownDays?'<div class="al w">🟠 Trajectoire partielle : les journées futures non planifiées ne sont pas inventées.</div>':''}
      <details open><summary>🔁 Motifs récurrents</summary>${patterns.length?patterns.slice(0,3).map(x=>`<div class="al ${x.level||'w'}"><b>${esc0(x.title||x.type||'Motif')}</b><br>${esc0(x.text||x.message||'')}<small>${esc0(x.detail||'')}</small></div>`).join(''):'<div class="audit-empty">Aucun motif récurrent suffisamment établi dans les données connues.</div>'}</details>
    </div>`;
  }

  function liveCard(){return `<div class="mh25-live" id="mh28Live">
    <div class="mh25-live-top"><div><span class="mh25-kicker">SERVICE · TEMPS RÉEL</span><div class="mh25-live-state" data-live-state>—</div></div><button class="mh25-live-btn" data-live-action>▶ Démarrer le service</button></div>
    <div class="mh25-live-main"><strong data-live-clock>0h00</strong><div class="mh25-live-meta"><span>TTE <b data-live-tte>0h00</b></span><span>Amplitude <b data-live-amp>0h00</b></span><span>Pause <b data-live-pause>0h00</b></span></div></div>
    <div class="mh25-live-foot"><span>Début <b data-live-start>—</b> · Fin <b data-live-end>En cours</b></span><span data-live-note>Calcul automatique · synchronisé avec la journée</span></div>
  </div>`}

  function homeSkeleton(){
    const host=$('s-home'); if(!host)return;
    host.innerHTML=`<div class="mh25-shell mh28-home">
      ${intelligenceHtml()}
      <header class="mh25-pagehead"><div><span class="mh25-kicker">MESHEURES · AUJOURD’HUI</span><h2>Tableau de bord</h2><p id="mh28HomeDate"></p></div><button class="mh25-iconbtn" onclick="tab('reg')">⚙</button></header>
      ${liveCard()}
      <div class="mh25-grid2 mh25-gap"><button class="mh25-action" onclick="tab('jour')"><span>＋</span><b>Saisir</b><small>Journée / pauses</small></button><button class="mh25-action" onclick="tab('mois')"><span>▦</span><b>Planning</b><small>Calendrier / prévision</small></button><button class="mh25-action" onclick="tab('paie')"><span>€</span><b>Paie</b><small>HS / RC / brut</small></button><button class="mh25-action" onclick="tab('analyse')"><span>◌</span><b>Analyse</b><small>Alertes / tendances</small></button></div>
      <div class="mh25-section-title"><span>AUJOURD’HUI</span><button onclick="tab('jour')">Détails ›</button></div><div class="mh25-today" id="mh28Today"></div>
      <div class="mh25-section-title"><span>QUATORZAINE</span><button onclick="tab('paie')">Voir la paie ›</button></div><div class="mh25-period" id="mh28Period"></div>
      <div class="mh25-section-title"><span>PROCHAINE ÉCHÉANCE</span></div><div class="mh25-next" id="mh28Next"></div>
    </div>`;
    activeStructure='home';
    safe(window.MH25Live?.render,'live');
  }

  function refreshHome(){
    const k=today(),d=DB.days?.[k]||{t:'REPOS'},r=engine.day(k),m=engine.month(k.slice(0,7)),pi=periodInfo();
    const date=$('mh28HomeDate'); if(date)date.textContent=(typeof shortY==='function'?shortY(k):k)+' · '+(typeof dow==='function'?dow(k).toUpperCase():'');
    const today=$('mh28Today'); if(today)today.innerHTML=`<div class="mh25-big"><strong>${fmt(r.tte)}</strong><span>${d.t==='T'?'Temps de travail effectif':d.t==='NUIT'?'Service de nuit':d.t==='CP'?'Congé payé':d.t==='RC'?'Repos compensateur':d.t==='MAL'?'Maladie':'Aucune journée travaillée'}</span></div><div class="mh25-stats"><span>Amplitude <b>${fmt(r.amp)}</b></span><span>Pauses <b>${fmt(r.pz)}</b></span><span>Paniers <b>${(r.ir+r.iru)||0}</b></span></div>`;
    const q=pi.q,N=pi.N,period=$('mh28Period'); if(period)period.innerHTML=`<div class="mh25-period-head"><b>${fmt(q.seuil)}</b><span>${short(pi.qs)} → ${short(addD(pi.qs,13))}</span></div><div class="mh25-progress"><i style="width:${pi.pc.toFixed(1)}%"></i></div><div class="mh25-period-foot"><span>${q.seuil<N?'Marge avant HS · '+fmt(N-q.seuil):'Seuil atteint'}</span><span>${fmt(q.h25)} HS25 · ${fmt(q.h50)} HS50</span></div>`;
    const nextKeys=Object.keys(DB.days||{}).filter(x=>x>k&&['T','NUIT'].includes(DB.days[x]?.t)).sort(),next=nextKeys[0],box=$('mh28Next');
    if(box)box.innerHTML=next?`<button onclick="mhOpenDay('${next}')"><span>📅</span><div><b>${shortY(next)} · ${dow(next).toUpperCase()}</b><small>${DB.days[next].deb||'Horaire à définir'}${DB.days[next].fin?' → '+DB.days[next].fin:''}</small></div><em>›</em></button>`:`<div class="mh25-empty">Aucune journée future planifiée.</div>`;
    safe(window.MH25Live?.render,'live');
    refreshIntelligence();
  }

  function refreshIntelligence(){
    const host=$('mh28Intel'); if(!host)return;
    const wrap=document.createElement('div'); wrap.innerHTML=intelligenceHtml(); const fresh=wrap.firstElementChild;
    if(fresh)host.replaceWith(fresh);
  }

  function renderHome(){
    if(activeStructure!=='home'||!$('mh28Today'))homeSkeleton();
    refreshHome();
  }

  function renderActive(){
    const t=window.curTab||'home';
    if(t==='home')return renderHome();
    if(!dirty.has(t))return;
    dirty.delete(t);
    if(t==='jour')safe(window.renderDay,'day');
    else if(t==='mois')safe(window.renderMonth,'month');
    else if(t==='paie')safe(window.renderPay,'pay');
    else if(t==='analyse')safe(window.renderAnalysis,'analysis');
    else if(t==='audit')safe(window.renderAudit,'audit');
    else if(t==='bul')safe(window.renderBulHist,'bulletins');
    else if(t==='romi')safe(window.renderRomiTab,'romi');
    else if(t==='reg')safe(window.renderReg,'settings');
    /* V30: modules that historically piggy-backed on renderAll are refreshed only
       when their owning tab is active. */
    if(t==='audit'){
      safe(window.mhV18RenderEvidence,'evidence');
      safe(window.mhV18ReconciliationRefresh,'reconciliation');
      safe(window.mhV18DossierRefresh,'dossier');
    }
    safe(window.MH25Live?.render,'live');
  }

  function activate(t){
    t=t||'home'; window.curTab=t;
    SECTIONS.forEach(x=>{$('s-'+x)?.classList.toggle('on',x===t);$('t-'+x)?.classList.toggle('on',x===t)});
    window.scrollTo(0,0);
  }
  function navigation(t){activate(t);dirty.add(t);schedule('navigate');}

  async function notifySystem(title,body,tag){try{if('Notification' in window&&Notification.permission==='granted'){new Notification(title,{body,tag});return true}const reg=await navigator.serviceWorker?.ready;if(reg?.showNotification)return reg.showNotification(title,{body,tag});}catch(e){}return false}

  let lastLiveMinute=-1;
  function liveTick(){
    liveTimer=0;
    if(document.visibilityState!=='visible')return;
    const active=!!safe(window.MH25Live?.active,'live-active');
    if(!active)return;
    const now=new Date(), minute=now.getMinutes();
    safe(window.MH25Live?.render,'live-render');
    try{const r=window.MH28DataEngine?.day(today())||{};const due=!!(Number(r.tte||0)>=360&&Number(r.pz||0)<20);if(due&&!window.__mh30PauseNotified){window.__mh30PauseNotified=true;notifySystem('MesHeures — pause obligatoire','20 min de pause à prévoir : le seuil de 6 h de TTE est atteint.','mh30-pause');}if(!due)window.__mh30PauseNotified=false;}catch(e){}
    if(minute!==lastLiveMinute){ lastLiveMinute=minute; schedule('live-minute'); }
    liveTimer=setTimeout(liveTick,15000);
  }

  function startLive(){if(liveTimer)clearTimeout(liveTimer);liveTimer=0;liveTick()}
  function stopLive(){if(liveTimer){clearTimeout(liveTimer);liveTimer=0}}

  async function registerBackgroundChecks(){
    try{
      if(!('serviceWorker' in navigator))return;
      const reg=await navigator.serviceWorker.ready;
      if('periodicSync' in reg){
        try{await reg.periodicSync.register('mesheures-background-check',{minInterval:6*60*60*1000});}catch(e){/* permission/platform dependent */}
      }
      await syncBackgroundSnapshot(reg);
    }catch(e){console.warn('MesHeures V30 background',e)}
  }
  async function syncBackgroundSnapshot(reg){
    try{
      if(!window.DB||!('indexedDB' in window))return;
      const intel=window.mhV18IntelligenceData?.(); const todayKey=today(); const todayRec=window.MH28DataEngine?.day(todayKey)||{}; const pauseDue=!!(window.MH25Live?.active?.() && Number(todayRec.tte||0)>=360 && Number(todayRec.pz||0)<20); const payload={version:V,updatedAt:new Date().toISOString(),days:DB.days||{},settings:{base:DB.s?.base||0,anchor:DB.s?.anchor||''},alerts:{firstRisk:intel?.projection?.firstRisk||null,pauseDue}};
      const req=indexedDB.open('mesheures-v30',1);
      req.onupgradeneeded=()=>{try{req.result.createObjectStore('state')}catch(e){}};
      req.onsuccess=()=>{try{const db=req.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put(payload,'snapshot');}catch(e){}};
    }catch(e){}
  }
  function scheduleBackgroundSnapshot(){try{syncBackgroundSnapshot()}catch(e){}}

  function installBackupReminder(){
    if(window.__mh30BackupReminder)return; window.__mh30BackupReminder=true;
    const KEY='mh30_last_external_backup';
    function check(){
      const last=Number(localStorage.getItem(KEY)||0), age=last?Date.now()-last:Infinity;
      if(age>=7*86400000){
        const host=document.getElementById('mh28Next');
        if(host && !document.getElementById('mh30BackupReminder')){
          const d=document.createElement('div');d.id='mh30BackupReminder';d.className='card';
          d.innerHTML='<b>🛡️ Sauvegarde externe recommandée</b><p class="mut">Aucune sauvegarde externe depuis 7 jours. Exporte une copie chiffrée pour ne pas dépendre de ce téléphone.</p><button onclick="mhV18EncryptedBackup();localStorage.setItem(\''+KEY+'\',Date.now())">🔐 Exporter une sauvegarde</button>';
          host.after(d);
        }
      }
    }
    check(); setInterval(check,6*60*60*1000);
  }

  function boot(){
    if(booted)return; booted=true;
    document.documentElement.dataset.mhVersion=V;
    if($('mhVersion'))$('mhVersion').textContent='V30.0.0';
    document.title='MesHeures V30.0';
    patchSave();
    if(window.__mh30PendingRefresh){ const pending=window.__mh30PendingRefresh; delete window.__mh30PendingRefresh; }
    /* Retire le scheduler V25 : V28 is the only runtime owner. */
    try{if(window.MH25Live?.tick){clearInterval(window.MH25Live.tick);window.MH25Live.tick=null}}catch(e){}
    window.renderHome=renderHome;
    /* Final compatibility boundary: legacy renderAll callers are routed into the
       reactive scheduler instead of executing the historical full redraw chain. */
    window.renderAll=function(reason){ return schedule(reason||'legacy-renderAll'); };
    window.MH28={version:V,engine,navigate:navigation,refresh:(reason)=>schedule(reason||'refresh'),invalidate:r=>engine.invalidate(r),stats:()=>engine.stats()};
    window.tab=navigation;
    activate(window.curTab||'home');
    dirty=new Set(SECTIONS.filter(x=>$('s-'+x)));
    schedule('boot');
    startLive();
    registerBackgroundChecks();
    installBackupReminder();
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){engine.invalidate('visibility');schedule('visibility');startLive()}else stopLive()});
    window.addEventListener('pageshow',()=>{engine.invalidate('pageshow');schedule('pageshow');startLive()});
    window.addEventListener('pagehide',stopLive);
    document.addEventListener('mh:state-changed',()=>{engine.invalidate('event');schedule('event')});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
