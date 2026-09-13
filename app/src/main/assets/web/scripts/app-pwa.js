/* MesHeures V18.0.15 — persistance locale + synchronisation widget Android. */
function save(){
  try{localStorage.setItem(LS,JSON.stringify(DB))}
  catch(e){alert('Stockage plein : exportez vos données !\n'+e.message)}
  pushWidgetData();
}

/* Le widget est un miroir : toutes les valeurs viennent des fonctions de calcul
   existantes. Aucun calcul légal ou paie n'est réimplémenté côté Android. */
function pushWidgetData(){
  try{
    if(!window.MesHeuresAndroid||typeof window.MesHeuresAndroid.updateWidgetData!=='function')return;
    const k=(typeof today==='function')?today():null;
    if(!k)return;
    const r=(typeof cd==='function')?cd(k):null;
    const m=(typeof mhMonthStats==='function')?mhMonthStats(k.slice(0,7)):null;
    let weekMin=0;
    if(typeof mono==='function'&&typeof cd==='function'){
      const ws=mono(k); for(let x=ws;x<=addD(ws,6);x=addD(x,1)) weekMin+=Math.round(cd(x)?.tte||0);
    }
    let periodMin=0;
    try{
      const ps=DB.per||{}; const start=ps.start||DB.s.anchor; const nb=Math.max(2,Math.min(3,Number(ps.nb)||2));
      if(typeof calcPer==='function')periodMin=Math.round(calcPer(start,nb).G?.tte||0);
    }catch(e){}
    let margeMin=null;
    try{
      const intel=(typeof window.mhV18IntelligenceData==='function')?window.mhV18IntelligenceData():null;
      if(intel&&intel.projection&&typeof intel.projection.margin==='number')margeMin=Math.round(intel.projection.margin);
    }catch(e){}
    let netCents=null;
    try{
      const pay=(typeof window.mhCurrentPaySummary==='function')?window.mhCurrentPaySummary():null;
      if(pay&&Number.isFinite(pay.netEst))netCents=Math.round(pay.netEst*100);
    }catch(e){}
    const payload={dateISO:k,tteJourMin:r?Math.round(r.tte||0):0,tteMoisMin:m?Math.round(m.tte||0):0,tteSemaineMin:weekMin,ttePeriodeMin:periodMin,margeAvant46hMin:margeMin,alertesMois:m?(m.alerts||[]).length:0,netEstimeCents:netCents,updatedAt:Date.now()};
    window.MesHeuresAndroid.updateWidgetData(JSON.stringify(payload));
  }catch(e){console.warn('Widget MesHeures',e)}
}

function load(){
  try{
    const r=JSON.parse(localStorage.getItem(LS));
    if(r){
      DB={...DB,...r};
      DB.s={...DEF,...(r.s||{})};
      DB.per={...DB.per,...(r.per||{})};
      DB.periods=r.periods||[];
      DB.bul=r.bul||{};
      DB.bulletins=r.bulletins||[];
      DB.romi=r.romi||{};
      DB.constats=Array.isArray(r.constats)?r.constats:[];
      DB.events=Array.isArray(r.events)?r.events:[];
      DB.reconciliation=Array.isArray(r.reconciliation)?r.reconciliation:[];
    }
  }catch(e){console.warn('Chargement local impossible',e)}
  setTimeout(pushWidgetData,350);
}
