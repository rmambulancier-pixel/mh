/* MesHeures V27 — Reactive Runtime Orchestrator
 * One navigation owner, one batched renderer, adaptive live ticking.
 * V26 remains available only as a compatibility namespace.
 */
(function(){
  'use strict';
  const V='27.0.0';
  const sections=['home','jour','mois','paie','analyse','audit','bul','romi','reg'];
  const $=id=>document.getElementById(id);
  let raf=0, liveTimer=0, saveWrapped=false;

  function safe(fn,label){try{return typeof fn==='function'?fn():null}catch(e){console.warn('MesHeures V27 '+label,e);return null}}
  function activate(t){
    t=t||'home';
    if(t==='jour'&&!window.curDate){window.curDate=today();window.curMonth=window.curDate.slice(0,7)}
    if(t==='mois'&&!window.curMonth){window.curMonth=today().slice(0,7);window.curDate=today()}
    window.curTab=t;
    sections.forEach(x=>{
      $('s-'+x)?.classList.toggle('on',x===t);
      $('t-'+x)?.classList.toggle('on',x===t);
    });
    window.scrollTo(0,0);
  }
  function renderCurrent(){
    const t=window.curTab||'home';
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
    repair(t);
  }
  function repair(t){
    if(t==='mois'){
      const ok=!!($('mLbl')?.textContent?.trim()||$('mCal')?.textContent?.trim());
      if(!ok)safe(window.renderMonth,'month-repair');
    }else if(t==='paie'){
      const ok=!!($('pKpi')?.textContent?.trim()||$('pSim')?.textContent?.trim());
      if(!ok)safe(window.renderPay,'pay-repair');
    }
  }
  function schedule(reason){
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=0;renderCurrent();if(reason==='live')scheduleProjection();});
  }
  function scheduleProjection(){
    if(window.curTab==='home')safe(window.pushWidgetData,'widget');
  }
  function wrapSave(){
    if(saveWrapped||typeof window.save!=='function')return;
    const original=window.save;
    window.save=function(){const out=original.apply(this,arguments);schedule('save');return out};
    saveWrapped=true;
  }
  function stopLive(){if(liveTimer){clearTimeout(liveTimer);liveTimer=0}}
  function liveLoop(){
    stopLive();
    const active=!!safe(window.MH25Live?.active,'live-active');
    if(!active)return;
    safe(window.MH25Live?.render,'live-render');
    if(window.curTab==='home'||window.curTab==='analyse')schedule('live');
    liveTimer=setTimeout(liveLoop,1000);
  }
  function boot(){
    document.documentElement.dataset.mhVersion=V;
    if($('mhVersion'))$('mhVersion').textContent='V27.0.0';
    document.title='MesHeures V27.0';
    wrapSave();
    window.curTab=window.curTab||'home';
    activate(window.curTab);
    renderCurrent();
    stopLive();liveLoop();
    window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){wrapSave();schedule('visibility');liveLoop()}else stopLive()});
    window.addEventListener('pageshow',()=>{schedule('pageshow');liveLoop()});
    window.addEventListener('pagehide',stopLive);
    document.addEventListener('mh:state-changed',()=>schedule('event'));
  }
  window.MH27={version:V,navigate(t){activate(t);schedule('navigate')},refresh(){schedule('refresh')},invalidate(){schedule('invalidate')},stopLive};
  window.tab=t=>window.MH27.navigate(t);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
