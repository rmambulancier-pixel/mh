/* MesHeures V26 — Unified UI Orchestrator
 * One navigation transaction, one active renderer, one live scheduler.
 * Keeps the mature calculation/feature modules underneath while removing
 * cross-renderer races between the legacy and Flow layers.
 */
(function(){
  'use strict';
  const V='26.0.0';
  let renderTimer=0;
  let lastRevision=0;
  let renderedRevision=-1;
  let saveWrapped=false;
  const sections=['home','jour','mois','paie','analyse','audit','bul','romi','reg'];
  const NAV_LABELS=['Accueil','Saisie','Planning','Paie','Analyse'];
  const $=id=>document.getElementById(id);
  const safe=(fn,label)=>{try{return fn()}catch(e){console.warn('MesHeures V26 '+label,e);return null}};

  function wrapSave(){
    if(saveWrapped||typeof window.save!=='function')return;
    const original=window.save;
    window.save=function(){
      const out=original.apply(this,arguments);
      lastRevision++;
      scheduleRender('save');
      return out;
    };
    saveWrapped=true;
  }

  function activate(t){
    if(t==='jour' && !window.curDate){window.curDate=today();window.curMonth=curDate.slice(0,7)}
    if(t==='mois' && !window.curMonth){window.curMonth=today().slice(0,7);window.curDate=today()}
    window.curTab=t;
    sections.forEach(x=>{
      const sec=$('s-'+x),btn=$('t-'+x);
      if(sec)sec.classList.toggle('on',x===t);
      if(btn)btn.classList.toggle('on',x===t);
    });
    window.scrollTo(0,0);
  }

  function renderCurrent(){
    const t=window.curTab||'home';
    if(t==='home') safe(()=>window.renderHome(),'home');
    else if(t==='jour') safe(()=>window.renderDay(),'day');
    else if(t==='mois') safe(()=>window.renderMonth(),'month');
    else if(t==='paie') safe(()=>window.renderPay(),'pay');
    else if(t==='analyse') safe(()=>window.renderAnalysis?.(),'analysis');
    else if(t==='audit') safe(()=>window.renderAudit(),'audit');
    else if(t==='bul') safe(()=>window.renderBulHist?.(),'bulletins');
    else if(t==='romi') safe(()=>window.renderRomiTab?.(),'romi');
    else if(t==='reg') safe(()=>window.renderReg(),'settings');
    safe(()=>window.LiveEngine?.updateUI?.(),'live');
    renderedRevision=lastRevision;
  }

  function repairCriticalView(){
    const t=window.curTab;
    if(t==='mois'){
      const ok=$('mLbl')?.textContent?.trim() && $('mCal')?.textContent?.trim();
      if(!ok) safe(()=>window.renderMonth(),'month-repair');
    }
    if(t==='paie'){
      const ok=$('pKpi')?.textContent?.trim() || $('pSim')?.textContent?.trim();
      if(!ok) safe(()=>window.renderPay(),'pay-repair');
    }
  }

  function scheduleRender(reason){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>{renderCurrent();repairCriticalView()}, reason==='live'?0:16);
  }

  window.MH26={
    version:V,
    navigate:function(t){activate(t);renderCurrent();repairCriticalView()},
    refresh:function(){scheduleRender('refresh')},
    invalidate:function(){renderedRevision=-1;scheduleRender('invalidate')}
  };

  // V26 owns navigation. It deliberately does not call the old tab(), because
  // that function calls renderAll(), which can recurse through V25 wrappers.
  window.tab=function(t){window.MH26.navigate(t)};

  // V25 installed a second live interval. Replace it with one scheduler.
  try{if(window.MH25Live?.tick)clearInterval(window.MH25Live.tick)}catch(_){ }

  function boot(){
    document.documentElement.dataset.mhVersion=V;
    if($('mhVersion'))$('mhVersion').textContent='V26.0.0';
    document.title='MesHeures V26.0';
    wrapSave();
    activate(window.curTab||'home');
    renderCurrent();
    setTimeout(repairCriticalView,32);

    setInterval(()=>{
      try{
        const active=window.MH25Live?.active?.();
        if(active){
          safe(()=>window.MH25Live.render(),'live-tick');
          if(window.curTab==='home'||window.curTab==='analyse')scheduleRender('live');
        }
        if(renderedRevision!==lastRevision && !active) scheduleRender('state');
        wrapSave();
      }catch(_){ }
    },1000);

    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'){scheduleRender('visibility');safe(()=>window.MH25Live?.render?.(),'visibility-live')}
    });
    window.addEventListener('pageshow',()=>scheduleRender('pageshow'));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else setTimeout(boot,0);
})();
