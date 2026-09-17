/* MesHeures V28 — Data Engine + Render Scheduler
 * Goal: one canonical data pipeline, memoized derived metrics, and zero full
 * dashboard redraws for the live clock. Legacy UI remains the visual source.
 */
(function(){
  'use strict';
  const V='28.0.0';
  const SECTIONS=['home','jour','mois','paie','analyse','audit','bul','romi','reg'];
  const $=id=>document.getElementById(id);
  let raf=0, liveTimer=0, booted=false, baseTab=null, baseRenderAll=null;
  let dirty=new Set(['home']);

  function safe(fn,label){try{return typeof fn==='function'?fn():null}catch(e){console.warn('MesHeures V28 '+label,e);return null}}
  function invalidate(reason){
    dirty.add(window.curTab||'home');
    if(window.MH28DataEngine)window.MH28DataEngine.invalidate(reason||'state');
    schedule('data');
  }
  function activate(t){
    t=t||'home';
    if(t==='jour'&&!window.curDate){window.curDate=today();window.curMonth=window.curDate.slice(0,7)}
    if(t==='mois'&&!window.curMonth){window.curMonth=today().slice(0,7);window.curDate=today()}
    window.curTab=t;
    SECTIONS.forEach(x=>{$('s-'+x)?.classList.toggle('on',x===t);$('t-'+x)?.classList.toggle('on',x===t)});
    window.scrollTo(0,0);
  }
  function renderActive(){
    const t=window.curTab||'home';
    if(!dirty.has(t)&&t!=='home')return;
    dirty.delete(t);
    if(t==='home')safe(window.renderHome,'home');
    else if(t==='jour')safe(window.renderDay,'day');
    else if(t==='mois')safe(window.renderMonth,'month');
    else if(t==='paie')safe(window.renderPay,'pay');
    else if(t==='analyse')safe(window.renderAnalysis,'analysis');
    else if(t==='audit')safe(window.renderAudit,'audit');
    else if(t==='bul')safe(window.renderBulHist,'bulletins');
    else if(t==='romi')safe(window.renderRomiTab,'romi');
    else if(t==='reg')safe(window.renderReg,'settings');
    safe(window.LiveEngine?.updateUI,'live-ui');
  }
  function schedule(reason){
    if(reason)dirty.add(window.curTab||'home');
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=0;renderActive()});
  }
  function liveTick(){
    liveTimer=0;
    const active=!!safe(window.MH25Live?.active,'live-active');
    if(!active)return;
    // Only the live card changes every second. No dashboard reconstruction.
    safe(window.MH25Live?.render,'live-render');
    if(window.curTab==='home'||window.curTab==='jour'||window.curTab==='analyse')safe(window.pushWidgetData,'widget');
    liveTimer=setTimeout(liveTick,1000);
  }
  function startLive(){if(liveTimer)clearTimeout(liveTimer);liveTimer=0;liveTick()}
  function stopLive(){if(liveTimer){clearTimeout(liveTimer);liveTimer=0}}
  function navigation(t){
    activate(t);
    dirty.add(t);
    schedule('navigate');
    startLive();
  }
  function patchRenderAll(){
    if(window.__mh28RenderPatch||typeof window.renderAll!=='function')return;
    baseRenderAll=window.renderAll;
    window.renderAll=function(){
      // Compatibility for modules that explicitly request a full legacy render.
      // V28 still batches the visible repaint and never calls this from the live clock.
      dirty.add(window.curTab||'home');
      try{return baseRenderAll.apply(this,arguments)}finally{schedule('renderAll')}
    };
    window.__mh28RenderPatch=true;
  }
  function repairVisible(){
    const t=window.curTab||'home';
    if(t==='mois'){
      const ok=!!(($('mLbl')?.textContent||'').trim()||($('mCal')?.textContent||'').trim());
      if(!ok){dirty.add(t);schedule('repair')}
    }
    if(t==='paie'){
      const ok=!!(($('pKpi')?.textContent||'').trim()||($('pSim')?.textContent||'').trim());
      if(!ok){dirty.add(t);schedule('repair')}
    }
  }
  function boot(){
    if(booted)return;booted=true;
    document.documentElement.dataset.mhVersion=V;
    if($('mhVersion'))$('mhVersion').textContent='V28.0.0';
    document.title='MesHeures V28.0';
    patchRenderAll();
    baseTab=window.tab;
    // Stop the V25 interval: it rebuilt the entire home/day every second.
    try{if(window.Live&&window.Live.tick){clearInterval(window.Live.tick);window.Live.tick=null}}catch(e){}
    window.MH28={version:V,engine:window.MH28DataEngine,navigate:navigation,refresh:()=>schedule('refresh'),invalidate,stats:()=>window.MH28DataEngine?.stats()||{}};
    window.tab=navigation;
    activate(window.curTab||'home');
    dirty=new Set(SECTIONS.filter(x=>document.getElementById('s-'+x)));
    schedule('boot');
    startLive();
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'){schedule('visibility');startLive()}
      else stopLive();
    });
    window.addEventListener('pageshow',()=>{schedule('pageshow');startLive()});
    window.addEventListener('pagehide',stopLive);
    document.addEventListener('mh:state-changed',()=>invalidate('event'));
    repairVisible();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
