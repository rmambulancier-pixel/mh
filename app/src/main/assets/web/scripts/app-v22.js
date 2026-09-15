/* MesHeures V22 — UX layer. Keeps the existing calculation engine intact. */
(function(){
  'use strict';
  const V='22.0.0';
  const PRIMARY=['home','jour','mois','paie'];
  let touchX=null,touchY=null,touchTarget=null;
  let fresh=!!window.MH_V22_FRESH;

  function $id(id){return document.getElementById(id)}
  function activeIndex(){const t=typeof curTab==='string'?curTab:'home';return PRIMARY.indexOf(t)}
  function setDots(){
    const nav=$id('mhV22Dots');if(!nav)return;
    const i=activeIndex();[...nav.children].forEach((el,n)=>el.classList.toggle('on',n===i));
  }
  function setNavActive(){
    const nav=$id('mhV17Nav');if(!nav)return;
    const i=activeIndex();
    [...nav.querySelectorAll('button')].forEach((b,n)=>b.classList.toggle('v22-active',n===i));
    setDots();
  }
  function pageSwipe(next){
    const i=activeIndex();if(i<0)return;
    const ni=Math.max(0,Math.min(PRIMARY.length-1,i+next));
    if(ni===i)return;
    const dir=next>0?-1:1;
    document.documentElement.style.setProperty('--v22-dir',dir+'18px');
    if(ni===0)window.tab('home');
    else if(ni===1)window.tab('jour');
    else if(ni===2)window.tab('mois');
    else window.tab('paie');
    const sec=$id('s-'+PRIMARY[ni]);if(sec){sec.classList.remove('mh-v22-page-in');void sec.offsetWidth;sec.classList.add('mh-v22-page-in')}
    setNavActive();
  }

  function patchTab(){
    if(window.__mhV22TabPatched)return;
    const original=window.tab;
    if(typeof original!=='function')return;
    window.tab=function(t){
      original(t);
      setNavActive();
      const sec=$id('s-'+t);if(sec&&PRIMARY.includes(t)){sec.classList.remove('mh-v22-page-in');void sec.offsetWidth;sec.classList.add('mh-v22-page-in')}
    };
    window.__mhV22TabPatched=true;
  }

  function buildDots(){
    if($id('mhV22Dots'))return;
    const d=document.createElement('div');d.id='mhV22Dots';d.className='mh-v22-nav-state';
    PRIMARY.forEach(()=>d.appendChild(document.createElement('i')));
    document.body.appendChild(d);setDots();
  }

  function patchTouch(){
    if(window.__mhV22Touch)return;window.__mhV22Touch=true;
    document.addEventListener('touchstart',e=>{
      if(!e.touches[0])return;
      touchX=e.touches[0].clientX;touchY=e.touches[0].clientY;touchTarget=e.target;
    },{passive:true,capture:true});
    document.addEventListener('touchend',e=>{
      if(touchX===null||!e.changedTouches[0])return;
      const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;
      touchX=touchY=null;
      if(Math.abs(dx)<75||Math.abs(dx)<Math.abs(dy)*1.25)return;
      if(activeIndex()<0)return;
      /* Horizontal swipe is page navigation in V22. */
      e.preventDefault();e.stopImmediatePropagation();
      pageSwipe(dx<0?1:-1);
    },{passive:false,capture:true});
  }

  function cleanHome(){
    const g=document.querySelector('.dash-greeting');if(g)g.textContent='Tableau de bord';
    const b=$id('homeBackupStatus');if(b){b.textContent='';b.style.display='none'}
    const title=document.querySelector('.hero-pro-title');if(title)title.textContent='Situation du jour';
  }

  function cleanMenu(){
    const menu=$id('mhV17Menu');if(!menu)return;
    const h=menu.querySelector('.mh-v17-sheet-head b');if(h)h.textContent='MesHeures · Outils';
    const backups=[...menu.querySelectorAll('button')].find(b=>/Sauvegardes/.test(b.textContent||''));
    if(backups)backups.textContent='💾 Données';
  }

  function addDataStatus(){
    const host=$id('s-home');if(!host||$id('mhV22DataNote'))return;
    const n=document.createElement('div');n.id='mhV22DataNote';n.className='mh-v22-data-note';
    n.innerHTML='<span>✓</span><div><b>Historique sécurisé</b><br><span id="mhV22Range">Chargement des données…</span></div>';
    const smart=$id('homeSmart');
    host.insertBefore(n,smart||host.children[1]||null);
  }

  function refreshDataStatus(){
    const el=$id('mhV22Range');if(!el||!window.DB)return;
    const keys=Object.keys(DB.days||{}).filter(Boolean).sort();
    if(!keys.length){el.textContent='Aucune journée enregistrée';return}
    el.textContent=`${keys[0].split('-').reverse().join('/')} → ${keys[keys.length-1].split('-').reverse().join('/')} · ${keys.length} journées`;
  }

  async function loadLatestDefault(){
    if(!fresh)return;
    try{
      const r=await fetch('./data/mesheures-default-backup.json',{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const raw=await r.json();const data=raw?.format==='MesHeures Backup'?raw.data:raw;
      const days=data?.days||{};const keys=Object.keys(days).sort();
      if(keys[0]!=='2025-05-19')throw new Error('Historique incomplet : début '+(keys[0]||'inconnu'));
      DB={s:{...DEF,...(data.s||{}),appVersion:V},days:{...days},cmp:{...(data.cmp||{})},periods:Array.isArray(data.periods)?data.periods:[],bul:{...(data.bul||{})},bulletins:Array.isArray(data.bulletins)?data.bulletins:[],romi:{...(data.romi||{})},per:{start:'2025-05-19',nb:1,...(data.per||{})},exp:data.exp??null,constats:Array.isArray(data.constats)?data.constats:[],events:Array.isArray(data.events)?data.events:[],reconciliation:Array.isArray(data.reconciliation)?data.reconciliation:[]};
      DB.s.anchor='2025-05-19';
      save();
      curDate=today();curMonth=curDate.slice(0,7);
      renderAll();
      fresh=false;window.MH_V22_DEFAULT_LOADED=true;
      refreshDataStatus();
    }catch(e){console.warn('V22 default backup indisponible',e)}
  }

  function disableAutoBackup(){
    /* V22 keeps normal localStorage persistence; automatic snapshot copies are opt-in via Outils > Données. */
    try{localStorage.removeItem(LS+'_autoAt')}catch(e){}
  }

  function boot(){
    patchTab();buildDots();patchTouch();cleanHome();cleanMenu();addDataStatus();disableAutoBackup();refreshDataStatus();
    setTimeout(()=>{cleanHome();cleanMenu();setNavActive();refreshDataStatus()},50);
    loadLatestDefault();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
