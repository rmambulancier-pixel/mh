/* MesHeures V18.0.17 — persistance locale + synchronisation widget Android. */
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
    const ym=k.slice(0,7);
    const r=(typeof cd==='function')?cd(k):null;
    const m=(typeof mhMonthStats==='function')?mhMonthStats(ym):null;

    let weekMin=0;
    if(typeof mono==='function'&&typeof cd==='function'){
      const ws=mono(k);
      for(let x=ws;x<=addD(ws,6);x=addD(x,1))weekMin+=Math.round(cd(x)?.tte||0);
    }

    let periodMin=0,periodH25=0,periodH50=0;
    try{
      const ps=DB.per||{};
      const start=ps.start||DB.s.anchor;
      const nb=Math.max(2,Math.min(3,Number(ps.nb)||2));
      if(typeof calcPer==='function'){
        const pg=calcPer(start,nb).G||{};
        periodMin=Math.round(pg.tte||0);
        periodH25=Math.round(pg.h25||0);
        periodH50=Math.round(pg.h50||0);
      }
    }catch(e){}

    let marginMin=null;
    try{
      const intel=(typeof window.mhV18IntelligenceData==='function')?window.mhV18IntelligenceData():null;
      if(intel&&intel.projection&&typeof intel.projection.margin==='number')marginMin=Math.round(intel.projection.margin);
    }catch(e){}

    // Comptage mensuel : aucune règle de paie ici, uniquement les types déjà enregistrés.
    let work=0,rest=0,cp=0,mal=0;
    try{
      const last=isoOf(new Date(Number(k.slice(0,4)),Number(k.slice(5,7)),0));
      for(let d=ym+'-01';d<=last;d=addD(d,1)){
        const day=DB.days[d];
        if(!day)continue;
        if(day.t==='T'||day.t==='NUIT')work++;
        else if(day.t==='CP')cp++;
        else if(day.t==='MAL')mal++;
        else rest++;
      }
    }catch(e){}

    // Si un bulletin du mois courant existe, le widget privilégie le réel.
    // Sinon il affiche l'estimation de la période de paie courante.
    let grossCents=null,netCents=null,netLabel='Net estimé';
    try{
      const bs=(DB.bulletins||[]).filter(b=>b&&String(b.mois||'')===ym);
      const b=bs.length?bs[bs.length-1]:null;
      if(b&&Number.isFinite(Number(b.brut)))grossCents=Math.round(Number(b.brut)*100);
      if(b&&Number.isFinite(Number(b.net))){netCents=Math.round(Number(b.net)*100);netLabel='Net payé';}
    }catch(e){}
    if(netCents===null){
      try{
        const pay=(typeof window.mhCurrentPaySummary==='function')?window.mhCurrentPaySummary():null;
        if(pay&&Number.isFinite(pay.grossEst))grossCents=Math.round(pay.grossEst*100);
        if(pay&&Number.isFinite(pay.netEst))netCents=Math.round(pay.netEst*100);
      }catch(e){}
    }

    const type=DB.days[k]?.t||'REPOS';
    const payload={
      dateISO:k,monthLabel:(['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][Number(k.slice(5,7))-1]||ym)+' '+k.slice(0,4),
      dayIndex:Number(k.slice(8)),monthDays:Number(lastDayOfMonth(ym)),
      todayType:type,
      tteJourMin:r?Math.round(r.tte||0):0,
      tteMoisMin:m?Math.round(m.tte||0):0,
      tteSemaineMin:weekMin,ttePeriodeMin:periodMin,
      hs25PeriodeMin:periodH25,hs50PeriodeMin:periodH50,
      workCount:work,restCount:rest,cpCount:cp,malCount:mal,
      margeAvant46hMin:marginMin,alertesMois:m?(m.alerts||[]).length:0,
      grossCents,netCents,netLabel,updatedAt:Date.now()
    };
    window.MesHeuresAndroid.updateWidgetData(JSON.stringify(payload));
  }catch(e){console.warn('Widget MesHeures',e)}
}

function lastDayOfMonth(ym){
  const [y,m]=String(ym).split('-').map(Number);
  return new Date(y,m,0).getDate();
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
