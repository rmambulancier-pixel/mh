/* MesHeures V24 — Fluid Core: navigation, store facade, live dashboard and search. */
(function(){
  'use strict';
  const V='24.0.0';
  const PAGES=['home','jour','mois','paie','analyse'];
  const PAGE_LABELS={home:'Accueil',jour:'Saisie',mois:'Planning',paie:'Paie',analyse:'Analyse'};
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=m=>{m=Math.max(0,Math.round(Number(m)||0));return Math.floor(m/60)+'h'+String(m%60).padStart(2,'0')};
  const dateLabel=k=>k?new Date(k+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit'}):'';
  const todayKey=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
  const keys=()=>Object.keys(window.DB?.days||{}).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const worked=k=>['T','NUIT'].includes(window.DB?.days?.[k]?.t);
  const metrics=k=>{try{return typeof window.mhCalcDay==='function'?window.mhCalcDay(k):cd(k)}catch{return {tte:0,amp:0,al:[]}}};

  /* One public state facade. Existing business code remains the source of truth: DB. */
  window.MHStore=window.MHStore||{
    get(){return window.DB},
    days(){return window.DB?.days||{}},
    subscribe(fn){this._listeners=this._listeners||[];this._listeners.push(fn);return()=>{this._listeners=this._listeners.filter(x=>x!==fn)}},
    emit(){(this._listeners||[]).forEach(fn=>{try{fn(window.DB)}catch(e){console.warn('MHStore listener',e)}})}
  };

  function activeIndex(){const t=typeof curTab==='string'?curTab:'home';return PAGES.indexOf(t)}
  function setNav(){const n=$('mhV17Nav');if(!n)return;const i=activeIndex();n.querySelectorAll('button[data-v24-page]').forEach((b,j)=>b.classList.toggle('v24-active',j===i));const dots=$('mhV24Dots');if(dots)[...dots.children].forEach((d,j)=>d.classList.toggle('on',j===i));}

  function buildNav(){
    const n=$('mhV17Nav');
    if(n){
      n.innerHTML=PAGES.map((p,i)=>`<button data-v24-page="${p}" onclick="tab('${p}')"><span class="v24-nav-icon">${['⌂','＋','▣','€','◔'][i]}</span><span>${PAGE_LABELS[p]}</span></button>`).join('');
      n.classList.add('mh-v24-nav');
    }
    if(!$('mhV24Dots')){const d=document.createElement('div');d.id='mhV24Dots';d.className='mh-v24-dots';PAGES.forEach(()=>d.appendChild(document.createElement('i')));document.body.appendChild(d)}
    setNav();
  }

  function installTab(){
    if(window.__mhV24Tab)return;
    const old=window.tab;
    if(typeof old!=='function')return;
    window.__mhV24Tab=true;
    window.tab=function(t){
      if(!PAGES.includes(t)){ old(t); setNav(); return; }
      if(t==='jour' && !curDate){curDate=todayKey();curMonth=curDate.slice(0,7)}
      if(t==='mois' && !curMonth){curMonth=todayKey().slice(0,7);curDate=todayKey()}
      if(t==='analyse') ensureAnalysis();
      curTab=t;
      const all=['home','jour','mois','paie','audit','bul','romi','reg','analyse'];
      all.forEach(x=>{const sec=$('s-'+x);if(sec)sec.classList.toggle('on',x===t);const btn=$('t-'+x);if(btn)btn.classList.toggle('on',x===t)});
      document.documentElement.dataset.mhPage=t;
      try{window.scrollTo(0,0)}catch{}
      try{renderAll()}catch(e){console.warn('MesHeures navigation render',e)}
      if(t==='analyse'){try{renderAnalysis()}catch(e){console.warn('MesHeures analyse render',e)}}
      setNav();
      window.MHStore?.emit?.();
    };
    window.__mhV23TabPatched=true;
  }

  let drag=null,raf=0;
  function isInteractive(t){return !!t?.closest?.('input,textarea,select,button,a,[contenteditable="true"],.modal-bg,.mh-v24-search,.mh-v24-sheet,.cal')}
  function sectionFor(p){return $('s-'+p)}
  function resetDrag(){
    if(!drag)return;
    cancelAnimationFrame(raf);
    const {cur,next}=drag;
    if(cur){cur.style.transform='';cur.style.transition=''}
    if(next){next.style.transform='';next.style.transition='';next.style.position='';next.style.inset='';next.style.width='';next.style.zIndex=''}
    drag=null;
  }
  function animateCommit(ni,dir){
    const from=sectionFor(PAGES[activeIndex()]),to=sectionFor(PAGES[ni]);
    if(!from||!to){window.tab(PAGES[ni]);return}
    const w=Math.max(1,window.innerWidth);
    to.style.display='block';to.style.position='absolute';to.style.inset='0 auto auto 0';to.style.width='100%';to.style.zIndex='5';to.style.transform=`translate3d(${dir*w}px,0,0)`;
    from.style.transition='transform 170ms cubic-bezier(.22,.8,.2,1),opacity 170ms linear';
    to.style.transition='transform 170ms cubic-bezier(.22,.8,.2,1)';
    requestAnimationFrame(()=>{from.style.transform=`translate3d(${-dir*w*.22}px,0,0)`;from.style.opacity='.72';to.style.transform='translate3d(0,0,0)'});
    setTimeout(()=>{to.style.transition='';from.style.transition='';from.style.transform='';from.style.opacity='';to.style.transform='';to.style.position='';to.style.inset='';to.style.width='';to.style.zIndex='';window.tab(PAGES[ni])},185);
  }
  function installSwipe(){
    if(window.__mhV24Swipe)return;window.__mhV24Swipe=true;
    const root=document.querySelector('main');if(!root)return;
    root.style.touchAction='pan-y';
    root.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      if(isInteractive(e.target))return;
      const i=activeIndex();if(i<0)return;
      drag={x:e.clientX,y:e.clientY,startTime:e.timeStamp||performance.now(),i,cur:sectionFor(PAGES[i]),next:null,locked:false,moved:false};
      try{root.setPointerCapture(e.pointerId)}catch{}
    },{passive:true});
    root.addEventListener('pointermove',e=>{
      if(!drag)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(!drag.locked){
        if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
        if(Math.abs(dy)>Math.abs(dx)*1.05){resetDrag();return}
        if(Math.abs(dx)<=Math.abs(dy))return;
        drag.locked=true;drag.moved=true;
        const ni=drag.i+(dx<0?1:-1);
        if(ni<0||ni>=PAGES.length){drag.edge=true;return}
        drag.next=sectionFor(PAGES[ni]);
        if(drag.next){drag.next.style.display='block';drag.next.style.position='absolute';drag.next.style.inset='0 auto auto 0';drag.next.style.width='100%';drag.next.style.zIndex='5';drag.next.style.transform=`translate3d(${(dx<0?1:-1)*window.innerWidth}px,0,0)`;}
      }
      if(!drag.locked||drag.edge)return;
      e.preventDefault();
      const ni=drag.i+(dx<0?1:-1),dir=ni>drag.i?1:-1,w=Math.max(1,window.innerWidth);
      const progress=Math.min(1,Math.abs(dx)/w),resistance=progress>.9?0.18:1;
      const move=dx*resistance;
      cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
        if(drag?.cur){drag.cur.style.transition='none';drag.cur.style.transform=`translate3d(${move}px,0,0)`;drag.cur.style.opacity=String(1-Math.min(.28,progress*.28))}
        if(drag?.next){drag.next.style.transition='none';drag.next.style.transform=`translate3d(${dir*w+move}px,0,0)`}
      });
    },{passive:false});
    const end=e=>{
      if(!drag)return;
      const d=drag;drag=null;
      if(!d.locked||d.edge){if(d.cur){d.cur.style.transition='transform 120ms ease,opacity 120ms ease';d.cur.style.transform='translate3d(0,0,0)';d.cur.style.opacity='';setTimeout(()=>{if(d.cur){d.cur.style.transition='';d.cur.style.transform=''}},125)};if(d.next){d.next.style.transform='';d.next.style.display='none'};return}
      const dx=e.clientX-d.x,ni=d.i+(dx<0?1:-1),dir=ni>d.i?1:-1,w=Math.max(1,window.innerWidth),velocity=Math.abs(dx)/Math.max(1,(e.timeStamp||performance.now())-(d.startTime||e.timeStamp||performance.now()));
      const commit=Math.abs(dx)>Math.max(70,w*.18)||velocity>.65;
      if(commit){animateCommit(ni,dir)}else{if(d.cur){d.cur.style.transition='transform 150ms cubic-bezier(.22,.8,.2,1),opacity 150ms';d.cur.style.transform='translate3d(0,0,0)';d.cur.style.opacity=''}if(d.next){d.next.style.transition='transform 150ms cubic-bezier(.22,.8,.2,1)';d.next.style.transform=`translate3d(${dir*w}px,0,0)`;setTimeout(()=>{d.next.style.transition='';d.next.style.transform='';d.next.style.position='';d.next.style.inset='';d.next.style.width='';d.next.style.zIndex=''},155)}}
    };
    root.addEventListener('pointerup',end,{passive:true});root.addEventListener('pointercancel',end,{passive:true});
  }

  function injectHome(){
    const home=$('s-home');if(!home||$('mhV24Quick'))return;
    const card=document.createElement('div');card.id='mhV24Quick';card.className='mh-v24-section';
    card.innerHTML=`<div class="mh-v24-section-head"><div><span class="mh-v24-kicker">FLUID CORE</span><h2>Actions rapides</h2></div><button class="mh-v24-search-btn" onclick="mhV24OpenSearch()">⌕ Rechercher</button></div><div class="mh-v24-actions"><button onclick="tab('jour')"><b>＋</b><span>Nouvelle journée</span></button><button onclick="tab('mois')"><b>▦</b><span>Planning</span></button><button onclick="tab('paie')"><b>€</b><span>Paie</span></button><button onclick="tab('analyse')"><b>◔</b><span>Analyse</span></button></div><div id="mhV24WeekStrip"></div>`;
    home.insertBefore(card,home.firstChild?.nextSibling||null);
    renderWeekStrip();
  }
  function renderWeekStrip(){
    const host=$('mhV24WeekStrip');if(!host||!window.DB)return;
    const now=todayKey(),start=typeof mono==='function'?mono(now):now;
    const items=[];for(let i=0;i<7;i++){const k=addD(start,i),d=DB.days?.[k],r=metrics(k);items.push(`<button class="mh-v24-day ${k===now?'today':''}" onclick="curDate='${k}';tab('jour')"><span>${new Date(k+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short'})}</span><b>${d&&worked(k)?fmt(r.tte):'—'}</b><small>${d?.t==='CP'?'CP':d?.t==='MAL'?'Mal':d?.t==='RC'?'RC':d&&worked(k)?'Travail':'Repos'}</small></button>`)}
    host.innerHTML=`<div class="mh-v24-week-title"><span>Cette semaine</span><small>${start} → ${addD(start,6)}</small></div><div class="mh-v24-week">${items.join('')}</div>`;
  }

  function injectDaySummary(){
    const host=$('s-jour');if(!host||$('mhV24DaySummary'))return;
    const card=document.createElement('div');card.id='mhV24DaySummary';card.className='card mh-v24-live-summary';
    card.innerHTML=`<div class="mh-v24-section-head"><div><span class="mh-v24-kicker">JOURNÉE</span><h2 id="mhV24DayState">État</h2></div><span id="mhV24DayClock" class="mh-v24-clock">00h00</span></div><div id="mhV24DaySummaryBody"></div>`;
    host.insertBefore(card,host.children[1]||null);
    renderDaySummary();
  }
  function renderDaySummary(){
    const k=typeof curDate==='string'?curDate:todayKey(),d=DB?.days?.[k],r=metrics(k),live=d?.running&&k===todayKey();
    const h=$('mhV24DayState'),c=$('mhV24DayClock'),b=$('mhV24DaySummaryBody');if(!h||!c||!b)return;
    h.textContent=live?'EN SERVICE':(d?.t==='T'?'Journée travaillée':d?.t==='NUIT'?'Nuit':d?.t==='CP'?'Congé payé':d?.t==='MAL'?'Maladie':d?.t==='RC'?'Repos compensateur':'Repos');
    const elapsed=live&&d.startEpoch?Math.floor((Date.now()-Number(d.startEpoch))/60000):r.tte;c.textContent=fmt(elapsed);
    const next=live?'Le chronomètre est actif. Le compteur reste synchronisé avec le widget.':d?.deb&&d?.fin?`${d.deb} → ${d.fin} · ${fmt(r.tte)} TTE · ${fmt(r.amp)} amplitude`:'Renseignez le début et la fin pour obtenir le calcul complet.';
    b.innerHTML=`<div class="mh-v24-summary-grid"><div><span>Début</span><b>${d?.deb||'—'}</b></div><div><span>Fin</span><b>${d?.fin||'—'}</b></div><div><span>Pauses</span><b>${fmt(r.pz||0)}</b></div><div><span>Repos précédent</span><b>${previousRest(k)}</b></div></div><p>${esc(next)}</p>`;
  }
  function previousRest(k){
    const ks=keys().filter(x=>x<k&&worked(x));if(!ks.length)return '—';const p=ks.at(-1),r=metrics(p),n=metrics(k);if(r.fin==null||n.deb==null)return '—';return fmt(Math.max(0,1440+Number(n.deb)-Number(r.fin)))}

  function injectSearch(){
    if($('mhV24Search'))return;
    const box=document.createElement('div');box.id='mhV24Search';box.className='mh-v24-search';box.innerHTML=`<div class="mh-v24-search-backdrop" onclick="mhV24CloseSearch()"></div><div class="mh-v24-sheet" role="dialog" aria-label="Recherche"><div class="mh-v24-search-head"><b>Rechercher dans MesHeures</b><button onclick="mhV24CloseSearch()">✕</button></div><input id="mhV24SearchInput" type="search" autocomplete="off" placeholder="Date, journée, alerte, bulletin…"><div id="mhV24SearchResults"></div></div>`;document.body.appendChild(box);
    $('mhV24SearchInput').addEventListener('input',()=>renderSearch($('mhV24SearchInput').value));
  }
  function searchData(q){
    q=String(q||'').trim().toLowerCase();if(!q)return [];
    const out=[];
    for(const k of keys().reverse()){
      const d=DB.days[k],r=metrics(k);const hay=[k,d?.t,d?.deb,d?.fin,d?.note,r?.al?.map(x=>x.m).join(' ')].join(' ').toLowerCase();
      if(hay.includes(q))out.push({type:'day',k,d,r});
    }
    (DB.bulletins||[]).forEach(b=>{const hay=JSON.stringify(b).toLowerCase();if(hay.includes(q))out.push({type:'pay',label:b.mois||'Bulletin',data:b})});
    return out.slice(0,30);
  }
  function renderSearch(q){const h=$('mhV24SearchResults');if(!h)return;const r=searchData(q);if(!q){h.innerHTML='<div class="mh-v24-search-empty">Recherchez une date, une heure, une alerte ou un bulletin.</div>';return}h.innerHTML=r.length?r.map(x=>x.type==='day'?`<button class="mh-v24-result" onclick="mhV24GoDay('${x.k}')"><span>${dateLabel(x.k)}</span><b>${x.d.t||'Repos'} · ${fmt(x.r.tte||0)}</b><small>${x.d.deb||'—'} → ${x.d.fin||'—'}${x.r.al?.length?' · ⚠️ '+x.r.al.length:''}</small></button>`:`<button class="mh-v24-result" onclick="mhV24CloseSearch();tab('paie')"><span>PAIE</span><b>${esc(x.label)}</b><small>Bulletin trouvé</small></button>`).join(''):'<div class="mh-v24-search-empty">Aucun résultat.</div>'}
  function injectAnalysisToolbar(){
    const a=$('s-analyse');if(!a||$('mhV24AnalysisBar'))return;
    const c=document.createElement('div');c.id='mhV24AnalysisBar';c.className='card mh-v24-analysis-bar';c.innerHTML=`<div><span class="mh-v24-kicker">LECTURE RAPIDE</span><b>Analyse active</b><small>Les données historiques restent la source unique.</small></div><button onclick="mhV24OpenSearch()">⌕ Rechercher</button>`;a.insertBefore(c,a.firstChild);
  }

  function patchRender(){
    if(window.__mhV24Render)return;const old=window.renderAll;if(typeof old!=='function')return;window.__mhV24Render=true;
    window.renderAll=function(){old();injectHome();injectDaySummary();injectSearch();injectAnalysisToolbar();renderWeekStrip();renderDaySummary();setNav();};
  }
  function patchSave(){
    if(window.__mhV24Save)return;const old=window.save;if(typeof old!=='function')return;window.__mhV24Save=true;
    window.save=function(){const r=old.apply(this,arguments);window.MHStore.emit();return r};
  }
  window.mhV24OpenSearch=function(){injectSearch();$('mhV24Search').classList.add('on');setTimeout(()=>$('mhV24SearchInput')?.focus(),40);renderSearch('')};
  window.mhV24CloseSearch=function(){$('mhV24Search')?.classList.remove('on')};
  window.mhV24GoDay=function(k){window.mhV24CloseSearch();curDate=k;curMonth=k.slice(0,7);tab('jour')};
  function boot(){
    buildNav();installTab();patchRender();patchSave();injectHome();injectDaySummary();injectSearch();injectAnalysisToolbar();installSwipe();
    const v=$('mhVersion');if(v)v.textContent='V'+V;document.title='MesHeures V'+V;document.documentElement.dataset.mhVersion=V;
    if(typeof window.MHStore.subscribe==='function')window.MHStore.subscribe(()=>{renderWeekStrip();renderDaySummary()});
    try{window.MHStore.emit()}catch{}
    setNav();
    setTimeout(()=>{buildNav();setNav();},90);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
