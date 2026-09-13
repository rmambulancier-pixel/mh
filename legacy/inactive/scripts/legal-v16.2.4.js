/* MesHeures V16.2.4 — socle juridique transport sanitaire
 * Sources vérifiées le 11/09/2026 : Légifrance / Code du travail numérique.
 * CCNTR IDCC 0016 + accords spécifiques transport sanitaire.
 * Cette couche ne remplace pas un bulletin de paie : elle contrôle les minima
 * et les règles de temps de travail applicables au mode QUATORZAINE choisi.
 */
(function(){
  'use strict';

  const LEGAL={
    version:'16.2.4',
    checked:'2026-09-11',
    idcc:'0016',
    smicHourly:12.31,
    ambMin:{1:11.89,2:11.90,3:12.79},
    sundayHoliday:23.90,
    quatorzaineHours:70,
    hs25Hours:8,
    amplitudeNormal:12,
    amplitudeAbsolute:15,
    restDaily:11,
    restWeekly:35,
    weeklyMax:48,
    weeklyAverageMax:44,
    quarterlyMax:572,
    pauseMinutes:20,
    mealPauseMinutes:30,
    mealWindows:[['11:00','14:30'],['18:30','22:00']]
  };
  window.MH_LEGAL=LEGAL;

  function legalMin(level){
    const cc=LEGAL.ambMin[level]||LEGAL.ambMin[3];
    return Math.max(LEGAL.smicHourly,cc);
  }
  function level(){
    const n=Number(DB?.s?.ambNiv||3);
    return [1,2,3].includes(n)?n:3;
  }
  function money(n){return Number.isFinite(n)?n.toFixed(2).replace('.',',')+' €':'—';}
  function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  // Migration silencieuse des anciens défauts : on ne touche pas aux réglages
  // personnels déjà modifiés par l'utilisateur.
  function migrate(){
    if(!window.DB||!DB.s)return;
    const S=DB.s;
    if(S.pl===16)S.pl=8;
    if(S.maxAmp===14)S.maxAmp=12;
    if(S.panDeb==='11:45'&&S.panFin==='14:15'){S.panDeb='11:00';S.panFin='14:30';}
    if(S.nuitDeb==='21:00'&&S.nuitFin==='06:00'){S.nuitDeb='22:00';S.nuitFin='05:00';}
    if(S.dimPrime===0)S.dimPrime=LEGAL.sundayHoliday;
    if(!S.ambNiv)S.ambNiv=3;
    if(!S.legalMode)S.legalMode='quatorzaine';
    if(!S.legalUpdated)S.legalUpdated=LEGAL.checked;
    if(typeof save==='function')save();
  }

  // La couche légale force le barème 25 % = 8 premières heures au-delà de 70 h.
  const originalCalcPer=window.calcPer;
  if(typeof originalCalcPer==='function'&&!window.__mhLegalCalcWrapped){
    const wrapped=function(start,nb){
      const oldPl=DB.s.pl,oldBase=DB.s.base;
      try{
        if(DB.s.legalMode==='quatorzaine'){DB.s.base=35;DB.s.pl=LEGAL.hs25Hours;}
        return originalCalcPer(start,nb);
      }finally{DB.s.pl=oldPl;DB.s.base=oldBase;}
    };
    wrapped.__mhLegalCalc=true;
    window.calcPer=wrapped;
    window.__mhLegalCalcWrapped=true;
  }

  // Les indemnités dimanche/jours fériés ambulanciers sont forfaitaires.
  // On neutralise l'ancien calcul horaire des fériés et la valeur personnalisée
  // éventuelle de dimPrime lorsqu'elle vaut zéro/ancienne valeur.
  const originalBrutOf=window.brutOf;
  if(typeof originalBrutOf==='function'&&!window.__mhLegalBrutWrapped){
    const wrapped=function(G){
      const oldDim=DB.s.dimPrime;
      try{
        DB.s.dimPrime=0;
        const base=originalBrutOf({...G,fer:0});
        const dimCount=Array.isArray(G.dimJ)?G.dimJ.length:(G.dim||0);
        const ferCount=Array.isArray(G.ferJ)?G.ferJ.length:0;
        const dimAmt=dimCount*LEGAL.sundayHoliday;
        const ferAmt=ferCount*LEGAL.sundayHoliday;
        if(dimCount)base.L.push(['Indemnité dimanche conventionnelle',String(dimCount)+' dimanche(s)',money(LEGAL.sundayHoliday)+'/dim.',dimAmt]);
        if(ferCount)base.L.push(['Indemnité jour férié conventionnelle',String(ferCount)+' jour(s)',money(LEGAL.sundayHoliday)+'/jour',ferAmt]);
        base.tot+=dimAmt+ferAmt;
        return base;
      }finally{DB.s.dimPrime=oldDim;}
    };
    wrapped.__mhLegalBrut=true;
    window.brutOf=wrapped;
    window.__mhLegalBrutWrapped=true;
  }

  function addLegalAlerts(result,start,nb){
    const alerts=result.AL||[];
    const seen=new Set(alerts.map(a=>a.k+'|'+a.m));
    function add(k,lvl,m){const id=k+'|'+m;if(seen.has(id))return;seen.add(id);alerts.push({k,lvl,m});}

    // Contrôle précis de l'amplitude journalière : 12 h normale, 15 h maximum
    // dans les situations conventionnelles autorisées.
    for(let q=0;q<nb;q++){
      for(let i=0;i<14;i++){
        const k=addD(start,q*14+i),r=cd(k);
        if(!r.tte)continue;
        if(r.amp>LEGAL.amplitudeAbsolute*60)add(k,'b','Amplitude > 15 h : dépassement de la limite maximale conventionnelle.');
        else if(r.amp>LEGAL.amplitudeNormal*60)add(k,'w','Amplitude > 12 h : doit relever d’un cas conventionnel autorisé et rester exceptionnelle.');
        if(r.tte>=360){
          const d=DB.days[k],pauses=(d&&Array.isArray(d.p))?d.p:[];
          const durations=pauses.map(p=>{const a=P(p.d),b0=P(p.f);if(a==null||b0==null)return 0;let b=b0;if(b<a)b+=1440;return b-a;});
          const maxPause=Math.max(0,...durations);
          if(maxPause<LEGAL.pauseMinutes)add(k,'w','Pause légale de 20 min à contrôler après 6 h de travail effectif (art. L3121-16).');
        }
      }
    }

    // Repos quotidien entre deux postes.
    let prevK=null,prevEnd=null;
    const all=[];
    for(let q=0;q<nb;q++)for(let i=0;i<14;i++)all.push(addD(start,q*14+i));
    all.forEach(k=>{
      const r=cd(k);if(r.deb==null||r.fin==null)return;
      if(prevK){
        const gapDays=nDays(prevK,k);
        if(gapDays===1){
          const gap=1440+r.deb-prevEnd;
          if(gap<LEGAL.restDaily*60)add(k,'b','Repos quotidien inférieur à 11 h entre deux postes.');
        }
      }
      prevK=k;prevEnd=r.fin;
    });
    return result;
  }

  const rawCalc=window.calcPer;
  if(typeof rawCalc==='function'&&!window.__mhLegalAlertsWrapped){
    const wrapped=function(start,nb){
      const r=rawCalc(start,nb);
      return addLegalAlerts(r,start,nb);
    };
    wrapped.__mhLegalAlerts=true;
    window.calcPer=wrapped;
    window.__mhLegalAlertsWrapped=true;
  }

  function legalCard(){
    const host=document.getElementById('mh-v163-pro');
    if(!host||!DB?.s)return;
    const niv=level(),cc=LEGAL.ambMin[niv],floor=legalMin(niv),taux=Number(DB.s.taux)||0;
    let box=document.getElementById('mh-legal-1624');
    if(!box){box=document.createElement('div');box.id='mh-legal-1624';box.style.marginTop='12px';host.appendChild(box);}
    box.innerHTML=`
      <details open style="border:1px solid var(--line);border-radius:12px;padding:11px;background:#0d1117">
        <summary style="cursor:pointer;font-weight:700">⚖️ Contrôle légal · IDCC 0016 · vérifié le 11/09/2026</summary>
        <div class="mut" style="margin:9px 0">Socle transport sanitaire : Code du travail + CCNTR + accords spécifiques ambulanciers. Mode de décompte : <b>quatorzaine</b>.</div>
        <div class="kpis">
          <div class="kpi"><b>${niv}</b><span>Niveau ambulancier</span></div>
          <div class="kpi"><b>${money(cc)}</b><span>Min. CCN</span></div>
          <div class="kpi"><b>${money(LEGAL.smicHourly)}</b><span>SMIC 2026</span></div>
          <div class="kpi ${taux+0.001<floor?'bad':'ok'}"><b>${money(taux)}</b><span>Taux saisi</span></div>
        </div>
        <div class="al ${taux+0.001<floor?'b':'k'}" style="margin-top:9px">
          ${taux+0.001<floor?'🚨 Taux inférieur au minimum légal applicable : '+money(floor)+'/h.':'✅ Taux horaire au moins égal au minimum légal applicable : '+money(floor)+'/h.'}
        </div>
        <div class="mut" style="margin-top:9px;line-height:1.55">
          • HS : <b>25 % sur les 8 premières heures</b>, puis <b>50 %</b>.<br>
          • Quatorzaine : seuil de référence <b>70 h</b>.<br>
          • Amplitude : <b>12 h</b> normalement, jusqu’à <b>15 h</b> dans les cas conventionnels prévus.<br>
          • Repos quotidien : <b>11 h</b> minimum.<br>
          • Pause : <b>20 min</b> après 6 h de travail effectif ; repas <b>30 min</b> dans les plages conventionnelles.<br>
          • Indemnité dimanche/jour férié : <b>23,90 € forfaitaires</b> selon l’avenant ambulanciers en vigueur.
        </div>
      </details>`;
  }

  function patchPanel(){
    legalCard();
  }

  function wrapRenderPay(){
    if(typeof window.renderPay!=='function'||window.renderPay.__mhLegal1624)return;
    const original=window.renderPay;
    const wrapped=function(){
      const r=original.apply(this,arguments);
      setTimeout(()=>{try{legalCard();}catch(_){}} ,0);
      return r;
    };
    wrapped.__mhLegal1624=true;
    window.renderPay=wrapped;
  }

  function patchSettings(){
    const rg=document.getElementById('rg1');
    if(!rg||document.getElementById('mh-legal-settings'))return;
    const box=document.createElement('div');
    box.id='mh-legal-settings';box.className='card';box.style.marginTop='10px';
    const n=level();
    box.innerHTML=`<h2>⚖️ Référentiel paie légal</h2>
      <div class="grid">
        <div><label>Niveau ambulancier</label><select id="mhAmbNiv"><option value="1">Niveau 1 — 11,89 € CCN</option><option value="2">Niveau 2 — 11,90 € CCN</option><option value="3">Niveau 3 — 12,79 € CCN</option></select></div>
        <div><label>Décompte</label><input value="Quatorzaine · 70 h" disabled></div>
        <div><label>Minimum légal retenu</label><input id="mhLegalFloor" disabled></div>
      </div>
      <div class="mut" style="margin-top:8px">Le minimum retenu est le plus favorable entre le minimum conventionnel ambulancier et le SMIC en vigueur.</div>`;
    rg.parentNode?.insertBefore(box,rg.nextSibling);
    const sel=box.querySelector('#mhAmbNiv');if(sel){sel.value=String(n);sel.onchange=()=>{DB.s.ambNiv=Number(sel.value);save();patchSettings();renderAll();};}
    const floor=box.querySelector('#mhLegalFloor');if(floor)floor.value=money(legalMin(n))+'/h';
  }

  function syncVersion(){
    document.title=document.title.replace(/V16\.1(?:\.0)?|V16\.2(?:\.0|\.1|\.2|\.3|\.4)?|V16\.3(?:\.0)?/g,'V16.2.4');
    const meta=document.querySelector('meta[name="application-version"]');if(meta)meta.setAttribute('content','16.2.4');
    const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode())nodes.push(w.currentNode);
    nodes.forEach(n=>{if(/V16\.(?:1|2|3)(?:\.\d+)?/.test(n.nodeValue||''))n.nodeValue=n.nodeValue.replace(/V16\.(?:1|2|3)(?:\.\d+)?/g,'V16.2.4');});
  }

  function boot(){
    migrate();syncVersion();patchSettings();wrapRenderPay();
    if(typeof renderPay==='function')setTimeout(patchPanel,0);
  }
  window.addEventListener('load',boot);
  document.addEventListener('click',()=>setTimeout(()=>{syncVersion();patchSettings();wrapRenderPay();patchPanel();},0),{passive:true});
  window.addEventListener('mesheures:tab',()=>setTimeout(()=>{patchSettings();patchPanel();},0));
})();
