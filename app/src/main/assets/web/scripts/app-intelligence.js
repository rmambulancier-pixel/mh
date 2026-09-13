/* MesHeures V19.0.0 — intelligence locale : intelligence locale, patterns, projection 12 semaines, alertes */
(function(){
  const V='19.0.0';
  const LEGAL_WEEK=46*60;
  const WORK=['T','NUIT'];
  let calcCache=new Map(), calcSig='';
  function signature(){
    const d=DB.days||{}; const keys=Object.keys(d).sort();
    return keys.length+'|'+(keys.length?keys[0]+'|'+keys[keys.length-1]:'')+'|'+keys.reduce((n,k)=>n+(JSON.stringify(d[k]).length||0),0);
  }
  function minutesCached(k){
    const sig=signature(); if(sig!==calcSig){calcSig=sig;calcCache.clear();}
    if(calcCache.has(k))return calcCache.get(k);
    const m=minutesOf(k); calcCache.set(k,m); return m;
  }
  const isWork=k=>WORK.includes(DB.days?.[k]?.t);
  const minutesOf=k=>{const r=cd(k);return Math.max(0,Number(r.tte)||0)};
  const listDays=(a,b)=>{const out=[];for(let k=a;k<=b;k=addD(k,1))out.push(k);return out};

  function weeklyMap(from,to){
    const map={};
    for(let k=from;k<=to;k=addD(k,1)){
      const w=mono(k);map[w]=(map[w]||0)+minutesOf(k);
    }
    return map;
  }

  function recentDailyAverage(end){
    const vals=[];
    for(let i=1;i<=56;i++){
      const k=addD(end,-i);if(!isWork(k))continue;
      const m=minutesCached(k);if(m>0)vals.push(m);
    }
    if(!vals.length)return 0;
    vals.sort((a,b)=>a-b);
    const trimmed=vals.length>6?vals.slice(1,-1):vals;
    return Math.round(trimmed.reduce((a,b)=>a+b,0)/trimmed.length);
  }

  function rolling12(){
    const end=today(),start=addD(end,-83),map=weeklyMap(start,end);
    const weeks=[];let w=mono(start);const last=mono(end);
    for(;w<=last;w=addD(w,7))weeks.push(w);
    while(weeks.length<12)weeks.unshift(addD(weeks[0],-7));
    const vals=weeks.slice(-12).map(k=>map[k]||0);
    const total=vals.reduce((a,b)=>a+b,0),avg=total/12;
    return {weeks:weeks.slice(-12),vals,total,avg,margin:LEGAL_WEEK-avg};
  }

  function projection12(){
    const base=rolling12(), now=today(), horizon=addD(now,83), avgDay=recentDailyAverage(now);
    const future={}; let unknown=0,planned=0,estimated=0;
    for(let k=addD(now,1);k<=horizon;k=addD(k,1)){
      const d=DB.days?.[k];
      if(!d){unknown++;future[k]=null;continue;}
      if(WORK.includes(d.t)){
        planned++; const m=minutesCached(k);
        if(m>0)future[k]=m; else {future[k]=avgDay; if(avgDay>0)estimated++;}
      } else future[k]=0;
    }
    const valueFor=k=>{ if(k<=now)return minutesCached(k); return future[k]==null?0:future[k]; };
    let firstRisk=null, firstRiskAvg=null;
    for(let i=1;i<=84;i++){
      const end=addD(now,i), start=addD(end,-83);
      let total=0; for(let k=start;k<=end;k=addD(k,1)) total+=valueFor(k);
      const avg=total/12;
      if(avg>LEGAL_WEEK){firstRisk=end;firstRiskAvg=avg;break;}
    }
    const projectedFuture=Object.values(future).reduce((a,b)=>a+(b||0),0);
    const knownFutureWeeks=new Set(); Object.keys(future).forEach(k=>knownFutureWeeks.add(mono(k)));
    const projectedAvg=firstRiskAvg||base.avg;
    return {...base,avgDay,plannedDays:planned,estimatedDays:estimated,unknownDays:unknown,futureMinutes:projectedFuture,projectedAvg,firstRisk,knownFutureWeeks:knownFutureWeeks.size};
  }
  function patterns(){
    const keys=Object.keys(DB.days||{}).filter(isWork).sort();
    const out=[];
    const sundays=keys.filter(k=>dowN(k)===0);
    if(sundays.length>=4){
      const gaps=sundays.slice(1).map((k,i)=>nDays(sundays[i],k));
      const sorted=[...gaps].sort((a,b)=>a-b), med=sorted[Math.floor(sorted.length/2)];
      const near14=gaps.filter(g=>Math.abs(g-14)<=2).length;
      const uncomp=sundays.filter(k=>{for(let i=1;i<=7;i++){const x=addD(k,i);if(DB.days?.[x]?.t==='RC')return false;}return true;}).length;
      if(near14>=3){
        out.push({id:'sun14',level:uncomp>=Math.ceil(sundays.length*.6)?'bad':'warn',title:'Dimanches travaillés récurrents',text:`${sundays.length} dimanche(s) travaillé(s), intervalle médian ${med} jours ; ${uncomp} sans RC saisi dans les 7 jours suivants.`,detail:'Détection statistique : vérifier les repos/compensations réels et les justificatifs avant toute conclusion.'});
      }
    }
    const longAmp=keys.filter(k=>minutesCached(k)>12*60);
    if(longAmp.length>=3){
      const ratio=longAmp.length/Math.max(1,keys.length);
      out.push({id:'amp12',level:ratio>=.2?'bad':'warn',title:'Amplitudes > 12 h récurrentes',text:`${longAmp.length} journée(s) au-delà de 12 h d’amplitude sur ${keys.length} journée(s) travaillée(s).`,detail:'Vérifier le motif conventionnel de chaque extension.'});
    }
    const longTte=keys.filter(k=>minutesCached(k)>10*60);
    if(longTte.length>=3)out.push({id:'tte10',level:'warn',title:'TTE > 10 h récurrent',text:`${longTte.length} journée(s) dépassent 10 h de TTE.`,detail:'La répétition est signalée séparément des contrôles journée par journée.'});
    const noPause=keys.filter(k=>{const r=cd(k);return r.tte>=360&&r.pz<20});
    if(noPause.length>=3)out.push({id:'pause',level:'warn',title:'Pauses manquantes récurrentes',text:`${noPause.length} journée(s) d’au moins 6 h sans 20 min de pause détectée.`,detail:'À vérifier avec les pauses réellement prises et les données ROMI1.'});
    return out;
  }
  function notifyRisk(p){
    if(!p.firstRisk)return;
    const key=LS+'_v18risk_'+p.firstRisk;
    if(localStorage.getItem(key))return;
    localStorage.setItem(key,new Date().toISOString());
    try{if('Notification' in window&&Notification.permission==='granted')new Notification('MesHeures — alerte de trajectoire',{body:`Risque de dépassement de 46 h/12 semaines vers le ${shortY(p.firstRisk)}.`});}catch(e){}
  }

  function render(){
    const host=document.getElementById('mhV18Intelligence');if(!host)return;
    const p=projection12(),ps=patterns();
    const cls=p.margin<0?'bad':p.projectedAvg>LEGAL_WEEK?'bad':p.unknownDays?'warn':'ok';
    host.innerHTML=`<div class="card mh-v18-intel"><h2>🧠 Intelligence V18 <span class="sub">analyse locale</span></h2>
      <div class="mh-v18-kpis"><div><b>${F(Math.round(p.avg))}</b><span>moyenne actuelle / semaine</span></div><div><b class="${cls}">${F(Math.round(p.margin))}</b><span>marge avant 46 h</span></div><div><b>${F(Math.round(p.projectedAvg))}</b><span>trajectoire simulée</span></div></div>
      <div class="mh-v18-intel-bar"><i style="width:${Math.min(100,Math.max(0,p.avg/LEGAL_WEEK*100)).toFixed(1)}%"></i></div>
      <div class="mh-v18-intel-note">12 semaines glissantes · ${p.plannedDays} journée(s) future(s) planifiée(s) · ${p.unknownDays} journée(s) future(s) inconnue(s).${p.firstRisk?` ⚠️ Risque détecté vers le ${shortY(p.firstRisk)}.`:' Aucun dépassement projeté sur les journées futures connues.'}</div>
      ${p.unknownDays?'<div class="al w">🟠 Trajectoire partielle : les journées futures non planifiées ne sont pas inventées.</div>':''}
      <details open><summary>🔁 Motifs récurrents</summary>${ps.length?ps.map(x=>`<div class="al ${x.level}"><b>${esc(x.title)}</b><br>${esc(x.text)}<small>${esc(x.detail)}</small></div>`).join(''):'<div class="audit-empty">Aucun motif récurrent suffisamment établi dans les données connues.</div>'}</details>
      ${p.firstRisk?`<button class="b" style="width:100%;margin-top:8px" onclick="mhV18RequestAlerts()">🔔 Activer les alertes de trajectoire</button>`:''}
    </div>`;
    notifyRisk(p);
  }

  window.mhV18IntelligenceData=()=>({projection:projection12(),patterns:patterns()});
  window.mhV18RequestAlerts=async function(){
    try{if('Notification' in window){const r=await Notification.requestPermission();if(r==='granted')alert('✅ Alertes de trajectoire activées sur cet appareil.');else alert('ℹ️ Les alertes restent visibles dans MesHeures.');}else alert('ℹ️ Les notifications système ne sont pas disponibles ici.');}catch(e){alert('ℹ️ Les notifications système ne sont pas disponibles ici.');}
  };

  function inject(){
    const target=document.getElementById('s-home');if(!target||document.getElementById('mhV18Intelligence'))return;
    const host=document.createElement('div');host.id='mhV18Intelligence';
    const anchor=document.getElementById('homeSmart');anchor?.after(host) || target.prepend(host);
    render();
  }
  function patch(){
    if(window.__mhV18IntelPatch)return;window.__mhV18IntelPatch=true;
    const old=window.renderAll; if(old)window.renderAll=function(){old();inject();render();};
    const oldHome=window.renderHome;if(oldHome&&!window.__mhV18IntelHome){window.__mhV18IntelHome=true;window.renderHome=function(){oldHome();inject();render();};}
  }
  function boot(){
    patch();inject();
    setTimeout(()=>{try{inject();render();}catch(e){console.warn('V18 intelligence',e)}},500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
