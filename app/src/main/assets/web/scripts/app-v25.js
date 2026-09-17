/* MesHeures V25 — Flow UI + Live Service Engine
 * Presentation layer only: keeps the V24 calculation core as the source of truth.
 */
(function(){
  const V='28.0.0';
  const q=s=>document.querySelector(s);
  const el=id=>document.getElementById(id);
  const fmt=m=>typeof F==='function'?F(Math.round(m||0)):'0h00';
  const money=n=>typeof EUR==='function'?EUR(n):'—';
  const escapeHtml=s=>typeof esc==='function'?esc(s):String(s??'');

  function day(){return today();}
  function dayData(k=day()){return (DB.days&&DB.days[k])||{t:'REPOS',p:[]};}
  function ensureDay(k=day()){
    if(typeof gd==='function')return gd(k);
    if(!DB.days[k])DB.days[k]={t:'REPOS',p:[]};
    DB.days[k].p=DB.days[k].p||[];
    return DB.days[k];
  }
  function nowHHMM(){const n=new Date();return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');}
  function debEpoch(k,hhmm){
    if(!hhmm||!/^\d{1,2}:\d{2}$/.test(hhmm))return Date.now();
    const d=new Date(k+'T'+hhmm.padStart(5,'0')+':00');
    return isNaN(d.getTime())?Date.now():d.getTime();
  }

  /* ---------- Live service: DB-backed, restart-safe ---------- */
  const Live={
    tick:null,
    active(){const d=dayData();return d.t==='T'&&!!d.running&&Number(d.startEpoch)>0;},
    elapsedMs(){const d=dayData();if(!this.active())return 0;return Math.max(0,Date.now()-Number(d.startEpoch));},
    elapsedClock(){const s=Math.floor(this.elapsedMs()/1000);return `${Math.floor(s/3600)}h${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;},
    start(){
      const k=day(),d=ensureDay(k),t=nowHHMM();
      d.t='T';d.deb=d.deb||t;d.fin=null;d.running=true;d.startEpoch=debEpoch(k,d.deb);
      d.p=d.p||[];
      if(typeof save==='function')save();
      if(typeof mhRefresh==='function')mhRefresh('live-mutation'); else this.render();
    },
    stop(){
      const k=day(),d=ensureDay(k);if(!this.active())return;
      d.fin=nowHHMM();d.running=false;d.startEpoch=0;
      if(typeof save==='function')save();
      if(typeof mhRefresh==='function')mhRefresh('live-mutation'); else this.render();
    },
    toggle(){this.active()?this.stop():this.start();},
    render(){
      const d=dayData(),r=typeof cd==='function'?cd(day()):null;
      const live=this.active();
      document.querySelectorAll('[data-live-state]').forEach(x=>{x.textContent=live?'EN SERVICE':'SERVICE ARRÊTÉ';x.classList.toggle('is-live',live)});
      document.querySelectorAll('[data-live-clock]').forEach(x=>x.textContent=live?this.elapsedClock():fmt(r?.tte||0));
      document.querySelectorAll('[data-live-tte]').forEach(x=>x.textContent=fmt(r?.tte||0));
      document.querySelectorAll('[data-live-amp]').forEach(x=>x.textContent=fmt(r?.amp||0));
      document.querySelectorAll('[data-live-pause]').forEach(x=>x.textContent=fmt(r?.pz||0));
      document.querySelectorAll('[data-live-start]').forEach(x=>x.textContent=d.deb||'—');
      document.querySelectorAll('[data-live-end]').forEach(x=>x.textContent=d.fin||'En cours');
      document.querySelectorAll('[data-live-action]').forEach(x=>{x.textContent=live?'■ Arrêter le service':'▶ Démarrer le service';x.classList.toggle('stop',live)});
      document.querySelectorAll('[data-live-action]').forEach(x=>{x.onclick=()=>this.toggle();});
      const note=live&&r?.pz===0&&r?.tte>=360?'Pause de 20 min à prévoir':'Calcul automatique · synchronisé avec la journée';
      document.querySelectorAll('[data-live-note]').forEach(x=>x.textContent=note);
    }
  };
  window.MH25Live=Live;

  function quickSetTime(k,field,value){
    const d=ensureDay(k);d.t='T';d[field]=value;
    if(field==='deb'){
      // Saisir l'heure de début démarre le direct tout seul (si le jour est
      // aujourd'hui et pas déjà clôturé), en comptant depuis cette heure-là
      // et non depuis l'instant de la saisie.
      if(k===day()&&value&&!d.fin){d.running=true;d.startEpoch=debEpoch(k,value);}
      else{d.running=false;d.startEpoch=0;}
    }
    if(field==='fin'){d.running=false;d.startEpoch=0;}
    if(typeof save==='function')save();
    if(typeof mhRefresh==='function')mhRefresh('live-mutation'); else renderDay();
  }
  window.mh25SetTime=quickSetTime;

  function normalizeTimeInput(input){
    const raw=(input.value||'').trim().replace(/\s+/g,'');
    if(/^\d{1,2}$/.test(raw)){input.value=String(Number(raw)).padStart(2,'0')+':00';input.dispatchEvent(new Event('change',{bubbles:true}));return;}
    if(/^\d{3,4}$/.test(raw)){
      const n=raw.padStart(4,'0');const h=n.slice(0,-2),m=n.slice(-2);
      if(Number(h)<=23&&Number(m)<=59){input.value=String(Number(h)).padStart(2,'0')+':'+m;input.dispatchEvent(new Event('change',{bubbles:true}));}
    }
  }
  function bindSmartTimeInputs(root=document){
    root.querySelectorAll('input[type="time"],input[data-time-smart]').forEach(i=>{
      if(i.dataset.mh25bound)return;i.dataset.mh25bound='1';i.addEventListener('blur',()=>normalizeTimeInput(i));
    });
  }

  /* ---------- Shared compact components ---------- */
  function liveCard(compact=false){
    return `<div class="mh25-live ${compact?'compact':''}">
      <div class="mh25-live-top"><div><span class="mh25-kicker">SERVICE · TEMPS RÉEL</span><div class="mh25-live-state" data-live-state>—</div></div><button class="mh25-live-btn" data-live-action>▶ Démarrer le service</button></div>
      <div class="mh25-live-main"><strong data-live-clock>0h00</strong><div class="mh25-live-meta"><span>TTE <b data-live-tte>0h00</b></span><span>Amplitude <b data-live-amp>0h00</b></span><span>Pause <b data-live-pause>0h00</b></span></div></div>
      <div class="mh25-live-foot"><span>Début <b data-live-start>—</b> · Fin <b data-live-end>En cours</b></span><span data-live-note>Calcul automatique · synchronisé avec la journée</span></div>
    </div>`;
  }

  function periodInfo(){
    const k=day(),diff=nDays(DB.s.anchor,k),qs=addD(DB.s.anchor,Math.floor(diff/14)*14);
    const q=calcPer(qs,1).Q[0],N=DB.s.base*120,pc=N?Math.min(100,q.seuil/N*100):0;
    return {qs,q,N,pc};
  }

  /* ---------- Home: one cockpit, no repeated analytics ---------- */
  function renderHome25(){
    const host=el('s-home');if(!host)return;
    host.innerHTML=`<div class="mh25-shell">
      <header class="mh25-pagehead"><div><span class="mh25-kicker">MESHEURES · AUJOURD’HUI</span><h2>Tableau de bord</h2><p>${shortY(day())} · ${dow(day()).toUpperCase()}</p></div><button class="mh25-iconbtn" onclick="tab('reg')">⚙</button></header>
      ${liveCard()}
      <div class="mh25-grid2 mh25-gap">
        <button class="mh25-action" onclick="tab('jour')"><span>＋</span><b>Saisir</b><small>Journée / pauses</small></button>
        <button class="mh25-action" onclick="tab('mois')"><span>▦</span><b>Planning</b><small>Calendrier / prévision</small></button>
        <button class="mh25-action" onclick="tab('paie')"><span>€</span><b>Paie</b><small>HS / RC / brut</small></button>
        <button class="mh25-action" onclick="tab('analyse')"><span>◌</span><b>Analyse</b><small>Alertes / tendances</small></button>
      </div>
      <div class="mh25-section-title"><span>AUJOURD’HUI</span><button onclick="tab('jour')">Détails ›</button></div>
      <div class="mh25-today" id="mh25Today"></div>
      <div class="mh25-section-title"><span>QUATORZAINE</span><button onclick="tab('paie')">Voir la paie ›</button></div>
      <div class="mh25-period" id="mh25Period"></div>
      <div class="mh25-section-title"><span>PROCHAINE ÉCHÉANCE</span></div>
      <div class="mh25-next" id="mh25Next"></div>
    </div>`;
    renderHomeData();Live.render();bindSmartTimeInputs(host);
  }
  function renderHomeData(){
    const k=day(),d=dayData(k),r=cd(k),{qs,q,N,pc}=periodInfo();
    const month=mhMonthStats(k.slice(0,7));
    const todayBox=el('mh25Today');
    if(todayBox)todayBox.innerHTML=`<div class="mh25-big"><strong>${fmt(r.tte)}</strong><span>${d.t==='T'?'Temps de travail effectif':d.t==='NUIT'?'Service de nuit':d.t==='CP'?'Congé payé':d.t==='RC'?'Repos compensateur':d.t==='MAL'?'Maladie':'Aucune journée travaillée'}</span></div><div class="mh25-stats"><span>Amplitude <b>${fmt(r.amp)}</b></span><span>Pauses <b>${fmt(r.pz)}</b></span><span>Paniers <b>${(r.ir+r.iru)||0}</b></span></div>`;
    const period=el('mh25Period');if(period)period.innerHTML=`<div class="mh25-period-head"><b>${fmt(q.seuil)}</b><span>${short(qs)} → ${short(addD(qs,13))}</span></div><div class="mh25-progress"><i style="width:${pc.toFixed(1)}%"></i></div><div class="mh25-period-foot"><span>${q.seuil<N?'Marge avant HS · '+fmt(N-q.seuil):'Seuil atteint'}</span><span>${fmt(q.h25)} HS25 · ${fmt(q.h50)} HS50</span></div>`;
    const nextKeys=Object.keys(DB.days||{}).filter(x=>x>k&&['T','NUIT'].includes(DB.days[x]?.t)).sort();
    const next=nextKeys[0],nextBox=el('mh25Next');
    if(nextBox)nextBox.innerHTML=next?`<button onclick="mhOpenDay('${next}')"><span>📅</span><div><b>${shortY(next)} · ${dow(next).toUpperCase()}</b><small>${DB.days[next].deb||'Horaire à définir'}${DB.days[next].fin?' → '+DB.days[next].fin:''}</small></div><em>›</em></button>`:`<div class="mh25-empty">Aucune journée future planifiée.</div>`;
  }

  /* ---------- Day: single editor, live-first ---------- */
  function renderDay25(){
    const host=el('s-jour');if(!host)return;
    const k=curDate||day(),d=dayData(k),r=cd(k),isToday=k===day();
    const type=d.t||'REPOS';
    const types=[['T','Travail'],['REPOS','Repos'],['NUIT','Nuit'],['RC','RC'],['CP','Congé'],['MAL','Maladie']];
    host.innerHTML=`<div class="mh25-shell mh25-day-shell">
      <div class="mh25-daynav"><button class="mh25-iconbtn" onclick="goDay(-1)">‹</button><div><span>${dow(k).toUpperCase()}</span><b>${shortY(k)} ${isToday?'· AUJ.':''}</b></div><button class="mh25-iconbtn" onclick="goDay(1)">›</button></div>
      ${isToday?liveCard(true):''}
      <div class="mh25-typebar">${types.map(([v,l])=>`<button class="${type===v?'on':''}" onclick="mh25SetType('${v}')">${l}</button>`).join('')}</div>
      <div class="mh25-editor" id="mh25Editor"></div>
      <div class="mh25-day-summary"><div><span>Amplitude</span><b>${fmt(r.amp)}</b></div><div><span>TTE</span><b>${fmt(r.tte)}</b></div><div><span>Pauses</span><b>${fmt(r.pz)}</b></div><div><span>Paniers</span><b>${(r.ir+r.iru)||0}</b></div></div>
      ${r.al.length?`<div class="mh25-alerts">${r.al.map(a=>`<div class="mh25-alert ${a.lvl==='b'?'bad':'warn'}">${a.lvl==='b'?'🔴':'🟠'} ${escapeHtml(a.m)}</div>`).join('')}</div>`:''}
      <div class="mh25-bottom-actions"><button onclick="goToday()">Aujourd’hui</button><button onclick="dupliConfirm()">Copier veille</button><button class="danger" onclick="clearDay()">Effacer</button></div>
    </div>`;
    renderDayEditor25();Live.render();bindSmartTimeInputs(host);
  }
  function renderDayEditor25(){
    const k=curDate||day(),d=ensureDay(k),host=el('mh25Editor');if(!host)return;
    if(d.t==='T'||d.t==='NUIT'){
      host.innerHTML=`<div class="mh25-card"><div class="mh25-row2"><label>Début<input type="text" inputmode="numeric" data-time-smart value="${d.deb||''}" onchange="mh25SetTime('${k}','deb',this.value)"></label><label>Fin<input type="text" inputmode="numeric" data-time-smart value="${d.fin||''}" onchange="mh25SetTime('${k}','fin',this.value)"></label></div>
      <div class="mh25-meal"><span>🍽️ Panier repas</span><div>${[['', 'Auto'],['EXT','Extérieur'],['ENT','Intérieur'],['NON','Aucun']].map(([v,l])=>`<button class="${(d.panier||'')===v?'on':''}" onclick="mh25SetPanier('${v}')">${l}</button>`).join('')}</div></div>
      <div class="mh25-pauses"><div class="mh25-cardtitle"><span>Pauses</span><button onclick="mh25AddPause()">＋ Ajouter</button></div>${(d.p||[]).map((p,i)=>`<div class="mh25-pause"><input type="time" value="${p.d||''}" onchange="mh25SetPause(${i},'d',this.value)"><span>→</span><input type="time" value="${p.f||''}" onchange="mh25SetPause(${i},'f',this.value)" ><select onchange="mh25SetPause(${i},'ty',this.value)"><option value="ENT" ${p.ty==='ENT'?'selected':''}>Intérieur</option><option value="EXT" ${p.ty==='EXT'?'selected':''}>Extérieur</option></select><button onclick="mh25DelPause(${i})">×</button></div>`).join('')}</div>
      <label class="mh25-note">Note<input maxlength="120" value="${escapeHtml(d.note||'')}" onchange="mh25SetNote(this.value)" placeholder="Remarque, incident…"></label>
      <label class="mh25-check"><input type="checkbox" ${d.fer?'checked':''} onchange="mh25SetField('fer',this.checked)"> Jour férié travaillé · majoration 100 %</label></div>`;
    }else{
      host.innerHTML=`<div class="mh25-card mh25-empty-editor"><b>${({REPOS:'Journée de repos',RC:'Repos compensateur',CP:'Congé payé',MAL:'Journée maladie'})[d.t]||'Journée'}</b><span>Rien à saisir. Le planning et les compteurs s’actualiseront automatiquement.</span></div>`;
    }
  }
  window.mh25SetType=function(v){const d=ensureDay(curDate||day());d.t=v;d.p=d.p||[];if(v!=='T'&&v!=='NUIT'){d.running=false;d.startEpoch=0;}if(typeof save==='function')save();typeof mhRefresh==='function'?mhRefresh('day-mutation'):renderDay();};
  window.mh25SetPanier=function(v){const d=ensureDay(curDate||day());d.panier=v||null;save();typeof mhRefresh==='function'?mhRefresh('day-mutation'):renderDay();};
  window.mh25AddPause=function(){ensureDay(curDate||day()).p.push({d:'',f:'',ty:'ENT'});save();typeof mhRefresh==='function'?mhRefresh('day-mutation'):renderDay();};
  window.mh25DelPause=function(i){ensureDay(curDate||day()).p.splice(i,1);save();typeof mhRefresh==='function'?mhRefresh('day-mutation'):renderDay();};
  window.mh25SetPause=function(i,f,v){const d=ensureDay(curDate||day());d.p[i]=d.p[i]||{ty:'ENT'};d.p[i][f]=v;save();typeof mhRefresh==='function'?mhRefresh('day-mutation'):renderDay();};
  window.mh25SetNote=function(v){ensureDay(curDate||day()).note=v;save();};
  window.mh25SetField=function(f,v){ensureDay(curDate||day())[f]=v;save();typeof mhRefresh==='function'?mhRefresh('day-mutation'):renderDay();};

  /* ---------- Analysis: all intelligence in one place ---------- */
  function buildAnalysis(){
    if(el('s-analyse'))return;
    const sec=document.createElement('section');sec.id='s-analyse';
    sec.innerHTML=`<div class="mh25-shell"><header class="mh25-pagehead"><div><span class="mh25-kicker">MESHEURES · ANALYSE</span><h2>Centre de pilotage</h2><p>Une seule vue pour les tendances, risques et droits à vérifier.</p></div></header><div id="mh25Analysis"></div><div class="mh25-tools"><button onclick="tab('audit')">🛡️ Contrôle légal</button><button onclick="tab('bul')">📄 Bulletin</button><button onclick="tab('romi')">📋 ROMI1</button><button onclick="tab('reg')">⚙ Réglages</button></div></div>`;
    const main=document.querySelector('main');const pay=el('s-paie');main.insertBefore(sec,pay?.nextSibling||null);
  }
  function renderAnalysis(){
    const host=el('mh25Analysis');if(!host)return;
    const month=mhMonthStats(day().slice(0,7));
    let intel=null;try{intel=window.mhV18IntelligenceData?.();}catch(e){}
    const proj=intel?.projection||{};
    const patterns=intel?.patterns||[];
    const {q,N,pc}=periodInfo();
    const recent=[];for(let i=13;i>=0;i--){const k=addD(day(),-i),r=cd(k);if(r.tte>0)recent.push({k,m:r.tte});}
    const max=Math.max(1,...recent.map(x=>x.m));
    host.innerHTML=`<div class="mh25-card mh25-risk"><div class="mh25-cardtitle"><span>Trajectoire</span><b>${proj.avg?fmt(proj.avg):'—'} / semaine</b></div><div class="mh25-progress"><i style="width:${Math.min(100,Math.max(0,(proj.avg||0)/2760*100)).toFixed(1)}%"></i></div><div class="mh25-period-foot"><span>Marge avant 46 h · ${proj.margin!=null?fmt(proj.margin):'—'}</span><span>${proj.firstRisk?'⚠️ '+shortY(proj.firstRisk):'Aucun dépassement projeté'}</span></div></div>
      <div class="mh25-grid2 mh25-gap"><div class="mh25-stat"><span>TTE mois</span><b>${fmt(month.tte)}</b><small>${month.trav} jour(s) travaillé(s)</small></div><div class="mh25-stat"><span>Amplitude moyenne</span><b>${month.trav?fmt(month.amp/month.trav):'—'}</b><small>sur les jours travaillés</small></div><div class="mh25-stat"><span>Alertes</span><b class="${month.hard?'bad':''}">${month.alerts.length}</b><small>${month.hard} critique(s) · ${month.warn} attention</small></div><div class="mh25-stat"><span>HS période</span><b>${fmt(q.h25+q.h50)}</b><small>${fmt(q.h25)} à 25 % · ${fmt(q.h50)} à 50 %</small></div></div>
      <div class="mh25-card"><div class="mh25-cardtitle"><span>14 derniers jours</span><small>TTE</small></div><div class="mh25-bars">${recent.map(x=>`<button onclick="mhOpenDay('${x.k}')" title="${shortY(x.k)} · ${fmt(x.m)}"><i style="height:${Math.max(6,Math.round(x.m/max*100))}%"></i><span>${dOf(x.k).getDate()}</span></button>`).join('')}</div></div>
      <div class="mh25-card"><div class="mh25-cardtitle"><span>À surveiller</span><b>${patterns.length+month.alerts.length}</b></div>${patterns.slice(0,4).map(x=>`<div class="mh25-alert ${x.level==='bad'?'bad':'warn'}"><b>${escapeHtml(x.title)}</b><span>${escapeHtml(x.text)}</span></div>`).join('')}${month.alerts.slice(0,4).map(a=>`<button class="mh25-alert mh25-alert-btn ${a.lvl==='b'?'bad':'warn'}" onclick="mhOpenDay('${a.k}')"><b>${shortY(a.k)}</b><span>${escapeHtml(a.m)}</span> ›</button>`).join('')}${!patterns.length&&!month.alerts.length?'<div class="mh25-ok">✓ Aucun point à surveiller.</div>':''}</div>`;
  }

  window.MH25RenderAnalysis=renderAnalysis;

  /* ---------- Navigation ---------- */
  function buildNav25(){
    let nav=el('mhV17Nav');if(!nav){nav=document.createElement('nav');nav.id='mhV17Nav';document.body.appendChild(nav);}
    nav.className='mh-v17-nav mh25-nav';
    nav.innerHTML=`<button onclick="tab('home')">⌂<span>Accueil</span></button><button onclick="tab('jour')">＋<span>Saisie</span></button><button onclick="tab('mois')">▦<span>Planning</span></button><button onclick="tab('paie')">€<span>Paie</span></button><button onclick="tab('analyse')">◌<span>Analyse</span></button>`;
  }

  function boot(){
    // app-v25 is loaded after the legacy/core scripts (all are defer), so the
    // original renderers are available here. Capture them at boot, not at file
    // evaluation time, then keep one deterministic V25 orchestration layer.
    const oldRenderHome=window.renderHome,oldRenderDay=window.renderDay;
    const oldRenderMonth=window.renderMonth,oldRenderPay=window.renderPay;
    const oldTab=window.tab;
    window.renderHome=renderHome25;
    window.renderDay=renderDay25;
    /* V30 owns rendering; legacy renderAll orchestration removed. */
    if(oldTab&&!window.__mh25Tab){
      window.__mh25Tab=true;
      window.tab=function(t){
        buildAnalysis();
        oldTab(t);
        try{if(t==='home')renderHome25();}catch(e){console.warn('home25 tab',e)}
        try{if(t==='jour')renderDay25();}catch(e){console.warn('day25 tab',e)}
        try{if(t==='mois')oldRenderMonth?.();}catch(e){console.warn('month25 bridge',e)}
        try{if(t==='paie')oldRenderPay?.();}catch(e){console.warn('pay25 bridge',e)}
        try{if(t==='analyse')renderAnalysis();}catch(e){console.warn('analysis25 tab',e)}
        try{Live.render();}catch(e){}
      };
    }
    buildAnalysis();buildNav25();
    if(el('mhVersion'))el('mhVersion').textContent='V27.0.0';
    document.title='MesHeures V27.0';
    Live.render();
    renderHome25();renderDay25();renderAnalysis();
    if(Live.tick)clearInterval(Live.tick);
    Live.tick=null;
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){Live.render();try{pushWidgetData()}catch(e){}}});
    window.addEventListener('pageshow',()=>{Live.render();try{pushWidgetData()}catch(e){}});
    bindSmartTimeInputs(document);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
