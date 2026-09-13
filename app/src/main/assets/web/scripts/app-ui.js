// Interface et navigation — MesHeures
function pushUndo(desc){
  _undo={days:JSON.stringify(DB.days),periods:JSON.stringify(DB.periods),desc};
}

function doUndo(){
  if(!_undo)return;
  DB.days=JSON.parse(_undo.days);
  DB.periods=JSON.parse(_undo.periods);
  _undo=null;save();renderAll();
  closeModal('undoModal');
}

function closeModal(id){$('undoModal').classList.remove('on')}

function tab(t){
  if(t==='jour' && !curDate){curDate=today();curMonth=curDate.slice(0,7)}
  if(t==='mois' && !curMonth){curMonth=today().slice(0,7);curDate=today()}
  curTab=t;
  ['home','jour','mois','paie','audit','bul','romi','reg'].forEach(x=>{
    const sec=$('s-'+x),btn=$('t-'+x);
    if(sec)sec.classList.toggle('on',x===t);
    if(btn)btn.classList.toggle('on',x===t);
  });
  window.scrollTo(0,0);
  renderAll();
}

// Impression robuste : Android utilise le moteur d'impression natif,
// le navigateur/PWA conserve window.print().
function mhPrint(){
  try{
    if(window.MesHeuresAndroid && typeof window.MesHeuresAndroid.printPage==='function'){
      window.MesHeuresAndroid.printPage();
      return;
    }
  }catch(e){console.warn('Impression Android',e)}
  try{window.print()}catch(e){alert('❌ Impression indisponible : '+e.message)}
}

function goDay(n){curDate=addD(curDate,n);renderDay()}

function goToday(){curDate=today();curMonth=curDate.slice(0,7);renderDay();window.scrollTo(0,0)}

let mhDayMenuKey=null,mhLongTimer=null,mhLongTriggered=false;
function openDayMenu(k){
  mhDayMenuKey=k; curDate=k; curMonth=k.slice(0,7);
  const d=gd(k),r=cd(k);
  $('dayMenuTitle').textContent=shortY(k)+' · '+(d.t==='T'?'Travail':d.t==='NUIT'?'Nuit':d.t==='CP'?'Congé':d.t==='RC'?'RC':d.t==='MAL'?'Maladie':'Repos');
  $('dayMenuSummary').innerHTML=r.tte?`<b>${F(r.tte)} TTE</b> · ${F(r.amp)} amplitude${r.al.length?` · ⚠️ ${r.al.length} alerte(s)`:''}`:'Aucune heure saisie';
  $('dayDupTarget').value=addD(k,1);
  $('dayMenuModal').classList.add('on');
}
function dayMenuAction(action){
  const k=mhDayMenuKey; if(!k)return;
  if(action==='edit'){closeModal('dayMenuModal');mhOpenDay(k);return;}
  if(action==='detail'){closeModal('dayMenuModal');curDate=k;tab('jour');return;}
  if(action==='clear'){closeModal('dayMenuModal');curDate=k;clearDay();return;}
  if(action==='duplicate'){
    const target=$('dayDupTarget').value; if(!target)return alert('Choisis une date de destination.');
    if(target===k)return alert('La destination doit être différente.');
    const src=DB.days[k]; if(!src)return alert('Cette journée est vide.');
    if(DB.days[target] && DB.days[target].t!=='REPOS' && !confirm('La journée de destination contient déjà des données. Écraser ?'))return;
    pushUndo('Duplication '+short(k)+' → '+short(target));
    DB.days[target]=JSON.parse(JSON.stringify(src)); save(); closeModal('dayMenuModal'); curDate=target;curMonth=target.slice(0,7);tab('jour');
  }
}
function bindMonthLongPress(){
  const host=$('mCal'); if(!host||host.dataset.longpressBound)return; host.dataset.longpressBound='1';
  host.addEventListener('pointerdown',e=>{const b=e.target.closest('button.cel');if(!b)return;const m=b.getAttribute('onclick')?.match(/mhOpenDay\('([^']+)'\)/);if(!m)return;mhLongTriggered=false;mhLongTimer=setTimeout(()=>{mhLongTriggered=true;openDayMenu(m[1])},520)});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>host.addEventListener(ev,()=>clearTimeout(mhLongTimer)));
  host.addEventListener('click',e=>{if(!mhLongTriggered)return;mhLongTriggered=false;e.preventDefault();e.stopPropagation()},{capture:true});
}


function setD(f,v){
  const d=gd(curDate);
  if(f==='t'&&d.t!==v)pushUndo('Changement type '+d.t+'→'+v+' le '+short(curDate));
  d[f]=v; save(); renderDay();
}

function setP(i,f,v){const d=gd(curDate);if(!d.p[i])d.p[i]={ty:'ENT'};d.p[i][f]=v;save();renderDay()}

function addP(){gd(curDate).p.push({d:'',f:'',ty:'ENT'});save();renderDay()}

function clearDay(){
  const d=DB.days[curDate];
  if(!d || (d.t==='REPOS'&&!d.deb&&!d.fin&&!d.note&&!d.p?.length)) return;
  if(!confirm('Effacer les données de cette journée ?')) return;
  pushUndo('Effacement du '+short(curDate));
  DB.days[curDate]={t:'REPOS',p:[]};
  save();renderDay();
}

function delP(i){gd(curDate).p.splice(i,1);save();renderDay()}

function dupliConfirm(){
  const prev=DB.days[addD(curDate,-1)];
  if(!prev)return alert('Rien la veille à copier.');
  const d=gd(curDate);
  if(d.t!=='REPOS'||d.deb){
    if(!confirm('Le jour courant a déjà des données. Écraser avec la veille ?'))return;
  }
  pushUndo('Copie veille → '+short(curDate));
  DB.days[curDate]=JSON.parse(JSON.stringify(prev));
  save(); renderDay();
}

function renderDay(){
  const k=curDate,d=gd(k),r=cd(k);
  const isF=isFerie(k),isD=dowN(k)===0;
  $('dLbl').textContent=dow(k).toUpperCase()+' '+k.slice(8)+' '+MON[+k.slice(5,7)-1]+' '+k.slice(0,4)
    +(isF?' ☀️':'')+(isD&&!isF?' 🔵':'')+(k===today()?' • auj.':'');
  const TYPES={T:'Travail',REPOS:'Repos',NUIT:'Nuit',RC:'RC',CP:'Congé',MAL:'Maladie'};
  $('dType').innerHTML=Object.entries(TYPES).map(([x,l])=>
    `<button class="${d.t===x?'on':''}" onclick="setD('t','${x}')">${l}</button>`).join('');
  let h='';
  if(d.t==='T'||d.t==='NUIT'){
    h=`<div class="g2">
<div><label>Début</label><input type="time" value="${d.deb||''}" onchange="setD('deb',this.value)"></div>
<div><label>Fin</label><input type="time" value="${d.fin||''}" onchange="setD('fin',this.value)"></div>
</div>
<div style="margin-top:11px"><label>Pauses</label>`;
    const _a=P(d.deb),_b0=P(d.fin);
    let _b=_b0;
    if(_a!=null&&_b!=null&&_b<=_a)_b+=1440;
    const _pd=P(DB.s.panDeb),_pf=P(DB.s.panFin);
    const _panOK=_a!=null&&_b!=null&&_a<=_pd&&_b>=_pf;
    d.p.forEach((p,i)=>h+=`<div class="pz"><div class="row">
<input type="time" value="${p.d||''}" onchange="setP(${i},'d',this.value)" style="flex:1">
<input type="time" value="${p.f||''}" onchange="setP(${i},'f',this.value)" style="flex:1">
<button class="r" onclick="delP(${i})" style="padding:8px 11px">✕</button></div>
<div class="row" style="margin-top:7px;align-items:center">
<select onchange="setP(${i},'ty',this.value)" style="flex:1">
<option value="ENT"${p.ty==='ENT'?' selected':''}>Intérieur (IRU)</option>
<option value="EXT"${p.ty==='EXT'?' selected':''}>Extérieur (IR)</option>
</select>
<span class="mut">${_panOK?'🍽️ panier':'—'}</span></div></div>`);
    h+=`<button class="g" onclick="addP()" style="width:100%">+ Ajouter une pause</button></div>
<div style="margin-top:11px"><label>Panier repas</label>
<div class="chips">
<button class="${!d.panier?'on':''}" onclick="setD('panier',null)">Auto</button>
<button class="${d.panier==='EXT'?'on':''}" onclick="setD('panier','EXT')">🍽️ Extérieur</button>
<button class="${d.panier==='ENT'?'on':''}" onclick="setD('panier','ENT')">🍽️ Intérieur</button>
<button class="${d.panier==='NON'?'on':''}" onclick="setD('panier','NON')">Aucun</button>
</div>
<div class="mut">${!d.panier?(_panOK?'Auto : service couvrant la plage repas → 1 panier extérieur compté sans rien saisir.':'Auto : le service ne couvre pas toute la plage repas → aucun panier.'):'Choix forcé pour cette journée.'}</div>
</div>
<div style="margin-top:11px">
<label style="text-transform:none;font-size:14px;color:var(--txt)">
<input type="checkbox" ${d.fer?'checked':''} onchange="setD('fer',this.checked)"> ☀️ Jour férié travaillé (majoration 100 %)
</label></div>`;
  }
  const stateLabel={T:'Journée travaillée',REPOS:'Repos',NUIT:'Nuit',RC:'Repos compensateur',CP:'Congé payé',MAL:'Maladie'}[d.t]||d.t;
  const stateClass=d.t==='T'?'ok':d.t==='REPOS'?'mut':d.t==='NUIT'?'pur':'warn';
  $('dWork').innerHTML=`<div class="day-state ${stateClass}"><span>${stateLabel}</span>${r.al.length?`<b>⚠️ ${r.al.length} alerte${r.al.length>1?'s':''}</b>`:''}</div>${h}`;
  $('dNote').value=d.note||'';
  $('dKpi').innerHTML=[
    ['Amplitude',F(r.amp)],['TTE',F(r.tte)],['Pauses',F(r.pz)],
    ['IDAJ',r.idaj?F(r.idaj):'—'],['Paniers',(r.ir+r.iru)||'—'],
    ['H. nuit',r.nuit?F(r.nuit):'—']
  ].map(x=>`<div class="kpi"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
  $('dAl').innerHTML=r.al.map(a=>`<div class="al ${a.lvl}">${a.m}</div>`).join('');
  const diff=nDays(DB.s.anchor,k);
  const qs=addD(DB.s.anchor,Math.floor(diff/14)*14);
  const o=calcPer(qs,1).Q[0],N=DB.s.base*120,pc=Math.min(100,o.seuil/N*100);
  const barCls=pc>=100?'bar bad':pc>=85?'bar warn':'bar';
  $('dQuat').innerHTML=`<div class="mut">${short(qs)} → ${short(addD(qs,13))}</div>
<div class="${barCls}"><i style="width:${pc.toFixed(1)}%"></i></div>
<div class="row" style="justify-content:space-between">
<span><b>${F(o.seuil)}</b> / ${F(N)}</span>
<span class="mut">${o.seuil<N?'reste '+F(N-o.seuil)+' avant HS':'🔥 HS : '+F(o.h25)+' à 25% · '+F(o.h50)+' à 50%'}</span>
</div>`;
  renderProj(k,qs);
  if(_undo){
    $('undoDesc').textContent=_undo.desc;
  }
}

function renderProj(k,qs){
  const qEnd=addD(qs,13);
  const today_=today();
  if(k>qEnd||k<qs){$('dProj').innerHTML='<span class="mut">Navigue dans la quatorzaine courante pour voir la projection.</span>';return}
  const restant=nDays(today_,qEnd);
  if(restant<=0){$('dProj').innerHTML='<span class="mut">Quatorzaine terminée.</span>';return}
  $('dProjLbl').textContent=short(qs)+' → '+short(qEnd);
  const o=calcPer(qs,1).Q[0];
  const N=DB.s.base*120;
  const trav=o.trav||1;
  const moyJ=o.seuil/trav;
  const joursTravRestants=Math.round(restant*trav/(nDays(qs,today_)+1||1));
  const proj=o.seuil+joursTravRestants*moyJ;
  const projH25=Math.min(Math.max(proj-N,0),DB.s.pl*60);
  const projH50=Math.max(proj-N-DB.s.pl*60,0);
  $('dProj').innerHTML=`
<div class="g2">
<div class="kpi"><b>${restant}</b><span>Jours restants</span></div>
<div class="kpi ${projH50>0?'bad':projH25>0?'warn':''}"><b>${F(Math.round(proj))}</b><span>TTE projetée</span></div>
</div>
<div class="mut" style="margin-top:6px">
Projection à rythme constant : <b>${F(Math.round(projH25))}</b> HS 25% · <b>${F(Math.round(projH50))}</b> HS 50%
<br>Marge avant HS : <b>${F(Math.max(N-o.seuil,0))}</b>
</div>`;
}

function goMonth(n){const d=dOf(curMonth+'-01');d.setMonth(d.getMonth()+n);curMonth=isoOf(d).slice(0,7);renderMonth()}

function goPer(n){
  DB.per.start=addD(DB.per.start,n*14*DB.per.nb);
  save();renderPay();
}

function regPer(){
  const s=DB.per.start;
  const ex=DB.periods.find(p=>p.start===s);
  if(ex)ex.nb=DB.per.nb;
  else DB.periods.push({start:s,nb:DB.per.nb});
  DB.periods.sort((a,b)=>a.start<b.start?-1:1);
  gb(s);save();
  alert('✅ Période enregistrée dans l\'audit');renderAll();
}

function renderPayBase(){
  const S=DB.s,st=DB.per.start,nb=DB.per.nb,B=gb(st);
  $('pS').value=st;$('pN').value=nb;
  $('pP25').value=B.p25??'';$('pP50').value=B.p50??'';
  $('pRC').value=B.rcOld??'';$('pRCA').value=B.rcAcq??'';
  $('pLbl').textContent=short(st)+' → '+short(addD(st,nb*14-1));
  const off=((nDays(S.anchor,st)%14)+14)%14;
  const reg=DB.periods.some(p=>p.start===st);
  $('pAlign').innerHTML=(off===0
    ?'<div class="al k">✅ Période alignée sur tes quatorzaines</div>'
    :'<div class="al w">⚠️ Décalage de '+off+' jour(s) — les HS peuvent être faussées. Ajuste la date de début.</div>')
    +(reg?'<div class="al i">📌 Période enregistrée dans l\'audit</div>':'');
  const{Q,AL,G}=calcPer(st,nb);
  $('pKpi').innerHTML=[
    ['Amplitude',F(G.amp)],['TTE',F(G.tte)],
    ['HS 25 %',F(G.h25),G.h25>0?'warn':''],
    ['HS 50 %',F(G.h50),G.h50>0?'bad':''],
    ['Jours trav.',G.trav],['Paniers',G.ir+G.iru],
    ['Dimanches',G.dim],['IDAJ',C2(G.idaj)+' h']
  ].map(x=>`<div class="kpi ${x[2]||''}"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
  let h='<tr><th>Détail</th><th class="n">Ampl.</th><th class="n">TTE</th><th class="n">Norm.</th><th class="n">HS 25%</th><th class="n">HS 50%</th></tr>';
  Q.forEach((o,i)=>{
    o.w.forEach((s,j)=>h+=`<tr><td>Sem. ${j+1} — ${short(s.start)}</td><td class="n">${F(s.amp)}</td><td class="n">${F(s.tte)}</td><td class="n mut" colspan="3">${s.trav} j</td></tr>`);
    h+=`<tr class="q"><td>Quatorzaine ${i+1}</td><td class="n">${F(o.amp)}</td><td class="n">${F(o.seuil)}</td><td class="n">${F(o.nor)}</td><td class="n">${F(o.h25)}</td><td class="n">${F(o.h50)}</td></tr>`;
  });
  h+=`<tr class="t"><td>TOTAL</td><td class="n">${F(G.amp)}</td><td class="n">${F(G.tte)}</td><td class="n">${F(G.nor)}</td><td class="n">${F(G.h25)}</td><td class="n">${F(G.h50)}</td></tr>`;
  $('pTab').innerHTML=h;
  $('pAlCount').textContent=AL.length?AL.length+' alerte(s)':'';
  $('pAl').innerHTML=AL.length
    ?AL.map(a=>`<div class="al ${a.lvl}"><b>${short(a.k)}</b> — ${esc(a.m)}</div>`).join('')
    :'<div class="al k">✅ Aucune anomalie détectée sur cette période</div>';
  const{L,tot,panIR,panIRU,panIRUT}=brutOf(G);
  $('pBrut').innerHTML='<tr><th>Élément</th><th class="n">Qté</th><th class="n">Taux</th><th class="n">Montant</th></tr>'
    +L.map(x=>`<tr><td>${esc(x[0])}</td><td class="n">${x[1]}</td><td class="n mut">${x[2]}</td><td class="n">${EUR(x[3])}</td></tr>`).join('')
    +`<tr class="t"><td>Brut soumis à cotisations</td><td colspan="2"></td><td class="n">${EUR(tot)}</td></tr>`
    +`<tr><td>Net estimé</td><td colspan="2" class="n mut">× ${S.net}</td><td class="n">${EUR(tot*S.net)}</td></tr>`
    +`<tr><td>IR (${G.ir} repas ext.)</td><td colspan="2" class="n mut">${S.ir} €/repas</td><td class="n">+ ${EUR(panIR)}</td></tr>`
    +`<tr><td>IRU brut (${G.iru} repas int.)</td><td colspan="2" class="n mut">${S.iru} €</td><td class="n">+ ${EUR(panIRU)}</td></tr>`
    +`<tr><td>IRU taux plein (${G.iru} repas)</td><td colspan="2" class="n mut">${S.irT} €</td><td class="n">(${EUR(panIRUT)} si taux plein)</td></tr>`
    +`<tr class="t"><td>Total versé estimé</td><td colspan="2"></td><td class="n">${EUR(tot*S.net+panIR+panIRU)}</td></tr>`;
  const d25=Math.max(G.h25/60-(B.p25||0),0),d50=Math.max(G.h50/60-(B.p50||0),0);
  const acq=d25*1.25+d50*1.5,sol=(B.rcOld||0)+acq;
  const perdu=d25*S.taux*1.25+d50*S.taux*1.5;
  const ec=B.rcAcq!=null?acq-B.rcAcq:null;
  $('pRcOut').innerHTML=`<table>
<tr><th>Type</th><th class="n">Dues calc.</th><th class="n">Payées</th><th class="n">→ RC</th><th class="n">× majo.</th></tr>
<tr><td>HS 25 %</td><td class="n">${C2(G.h25)}</td><td class="n">${B.p25!=null?B.p25.toFixed(2):'—'}</td><td class="n">${d25.toFixed(2)}</td><td class="n">${(d25*1.25).toFixed(2)}</td></tr>
<tr><td>HS 50 %</td><td class="n">${C2(G.h50)}</td><td class="n">${B.p50!=null?B.p50.toFixed(2):'—'}</td><td class="n">${d50.toFixed(2)}</td><td class="n">${(d50*1.5).toFixed(2)}</td></tr>
<tr class="t"><td>RC acquis ce mois</td><td colspan="3"></td><td class="n">${acq.toFixed(2)} h</td></tr>
<tr class="t"><td>Solde RC cumulé</td><td colspan="3"></td><td class="n">${sol.toFixed(2)} h</td></tr>
</table>
${ec!==null?`<div class="al ${Math.abs(ec)<0.1?'k':'b'}" style="margin-top:9px">
${Math.abs(ec)<0.1?'✅ RC bulletin conforme au calcul':'🚩 Écart RC : <b>'+ec.toFixed(2)+' h</b> = '+EUR(Math.abs(ec)*S.taux)+'</div>'}
</div>`:''}
<div class="al ${sol*S.taux>1500?'w':'i'}" style="margin-top:9px">
💰 Valeur RC non payé : <b>${EUR(perdu)}</b> brut · Solde total : <b>${EUR(sol*S.taux)}</b>
</div>
${sol>S.rcAlerte?`<div class="al b" style="margin-top:6px">🚨 Solde RC > ${S.rcAlerte}h — risque de perte ! Demandez la prise ou le paiement.</div>`:''}`;
  let c='<tr><th>Semaine</th><th class="n">TTE calculé</th><th class="n">TTE bulletin</th><th class="n">Écart</th></tr>';
  Q.forEach(o=>o.w.forEach(s=>{
    const v=DB.cmp[s.start]||'',e=v?P(v)-s.tte:null;
    c+=`<tr><td>${short(s.start)}</td><td class="n">${F(s.tte)}</td>
<td class="n"><input type="time" value="${v}" onchange="DB.cmp['${s.start}']=this.value;save();renderPay()" style="width:100px"></td>
<td class="n ${e===null?'':e===0?'ok':'bad'}">${e===null?'—':e===0?'✓':F(e)}</td></tr>`;
  }));
  $('pCmp').innerHTML=c;
}

function renderAuditBase(){
  if(!DB.periods.length){
    $('aKpi').innerHTML='<div class="audit-empty">Aucune période enregistrée pour le moment.</div>';
    $('aAnn').innerHTML='<tr><td class="mut">Enregistre une période depuis l’écran Paie pour alimenter l’audit.</td></tr>';
    $('aTab').innerHTML='<tr><td class="mut">Aucune période enregistrée.</td></tr>';
    $('aRc').innerHTML='<div class="audit-empty">Le solde RC apparaîtra ici après l’enregistrement d’une période.</div>';
    $('aFer').innerHTML='<div class="al i">Aucun dimanche ou jour férié enregistré dans une période d’audit.</div>';
    $('aAl').innerHTML='<div class="al k">✅ Aucun contrôle d’audit à signaler.</div>';
    return;
  }
  const S=DB.s;
  // Une même période peut avoir été enregistrée plusieurs fois. On ne doit jamais
  // afficher deux fois les mêmes événements dans l'audit. Les périodes qui se
  // chevauchent restent visibles et sont signalées afin de ne supprimer aucune donnée.
  const seenPeriods=new Set(),auditPeriods=[];
  (DB.periods||[]).forEach(p=>{
    const key=p.start+'|'+p.nb;
    if(!seenPeriods.has(key)){seenPeriods.add(key);auditPeriods.push(p)}
  });
  auditPeriods.sort((a,b)=>a.start.localeCompare(b.start));
  const overlaps=[];
  for(let i=1;i<auditPeriods.length;i++){
    const prev=auditPeriods[i-1],prevEnd=addD(prev.start,prev.nb*14-1);
    if(auditPeriods[i].start<=prevEnd)overlaps.push([prev,auditPeriods[i]]);
  }
  let T={tte:0,h25:0,h50:0,acq:0,dec:0,ecart:0,fer:[],dim:[],trav:0,nor:0},AA=[];
  let h='<tr><th>Période</th><th class="n">TTE</th><th class="n">HS25</th><th class="n">HS50</th><th class="n">RC calc.</th><th class="n">RC bull.</th><th class="n">Écart</th></tr>';
  const byYear={};
  auditPeriods.forEach(p=>{
    const{G,AL}=calcPer(p.start,p.nb),B=gb(p.start);
    const d25=Math.max(G.h25/60-(B.p25||0),0),d50=Math.max(G.h50/60-(B.p50||0),0),acq=d25*1.25+d50*1.5;
    const ec=B.rcAcq!=null?acq-B.rcAcq:null;
    T.tte+=G.tte;T.h25+=G.h25;T.h50+=G.h50;T.acq+=acq;
    T.dec+=B.rcAcq||0;T.trav+=G.trav;T.nor+=G.nor;
    if(ec!==null)T.ecart+=ec;
    G.ferJ.forEach(k=>T.fer.push(k));
    G.dimJ?.forEach(k=>T.dim.push(k));
    AL.forEach(a=>AA.push(a));
    const y=p.start.slice(0,4);
    if(!byYear[y])byYear[y]={tte:0,h25:0,h50:0,trav:0,nor:0};
    byYear[y].tte+=G.tte;byYear[y].h25+=G.h25;byYear[y].h50+=G.h50;byYear[y].trav+=G.trav;byYear[y].nor+=G.nor;
    h+=`<tr><td><a href="#" onclick="DB.per={start:'${p.start}',nb:${p.nb}};save();tab('paie');return false" style="color:var(--blue)">${short(p.start)}→${short(addD(p.start,p.nb*14-1))}</a></td>
<td class="n">${F(G.tte)}</td><td class="n">${C2(G.h25)}</td><td class="n">${C2(G.h50)}</td>
<td class="n">${acq.toFixed(2)}</td><td class="n">${B.rcAcq!=null?B.rcAcq.toFixed(2):'—'}</td>
<td class="n ${ec===null?'':Math.abs(ec)<0.1?'ok':'bad'}">${ec===null?'—':Math.abs(ec)<0.1?'✓':ec.toFixed(2)}</td></tr>`;
  });
  h+=`<tr class="t"><td>TOTAL</td><td class="n">${F(T.tte)}</td><td class="n">${C2(T.h25)}</td><td class="n">${C2(T.h50)}</td><td class="n">${T.acq.toFixed(2)}</td><td class="n">${T.dec.toFixed(2)}</td><td class="n ${Math.abs(T.ecart)<0.1?'ok':'bad'}">${T.ecart.toFixed(2)}</td></tr>`;
  $('aTab').innerHTML=h;
  $('aKpi').innerHTML=[
    ['Périodes',auditPeriods.length],['Jours travaillés',T.trav],
    ['TTE total',F(T.tte)],['HS 25 %',C2(T.h25)],['HS 50 %',C2(T.h50)],
    ['RC généré',T.acq.toFixed(2)+' h'],
    ['Valeur RC',EUR(T.acq*S.taux)],
    ['Écart bulletins',EUR(Math.abs(T.ecart)*S.taux),Math.abs(T.ecart)>0.5?'bad':'']
  ].map(x=>`<div class="kpi ${x[2]||''}"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
  let ay='<tr><th>Année</th><th class="n">Jours</th><th class="n">TTE</th><th class="n">HS 25%</th><th class="n">HS 50%</th><th class="n">Brut estimé</th></tr>';
  Object.entries(byYear).sort().forEach(([y,v])=>{
    const brt=v.nor/60*S.taux+(v.h25/60*S.taux*1.25)+(v.h50/60*S.taux*1.5);
    ay+=`<tr><td><b>${y}</b></td><td class="n">${v.trav}</td><td class="n">${F(v.tte)}</td><td class="n">${C2(v.h25)}</td><td class="n">${C2(v.h50)}</td><td class="n">${EUR(brt)}</td></tr>`;
  });
  $('aAnn').innerHTML=ay;
  const uniqueFer=[...new Set(T.fer)].sort();
  const uniqueDim=[...new Set(T.dim)].sort();
  const uniqueAlerts=[];const seenAlerts=new Set();
  AA.forEach(a=>{const key=a.k+'|'+a.lvl+'|'+a.m;if(!seenAlerts.has(key)){seenAlerts.add(key);uniqueAlerts.push(a)}});
  const overlapNote=overlaps.length
    ?`<div class="al w audit-overlap">⚠️ ${overlaps.length} chevauchement${overlaps.length>1?'s':''} entre périodes enregistrées. Vérifie qu’elles ne couvrent pas deux fois les mêmes journées.</div>`
    :'';
  $('aFer').innerHTML=overlapNote+(uniqueFer.length?uniqueFer.map(k=>{const r=cd(k);
    return `<div class="al w">☀️ <b>${shortY(k)}</b> — ${F(r.tte)} → maj. 100% = <b>${EUR(r.tte/60*S.taux)}</b></div>`}).join('')
    +`<div class="al i">Total fériés : <b>${EUR(uniqueFer.reduce((a,k)=>a+cd(k).tte/60*S.taux,0))}</b></div>`
    :'<div class="al k">✅ Aucun férié travaillé</div>')
    +(uniqueDim.length?uniqueDim.map(k=>`<div class="al w">🔵 <b>${shortY(k)}</b> dimanche travaillé</div>`).join(''):'');
  const rcSol=T.acq-T.dec;
  const barPct=Math.min(100,rcSol/S.rcAlerte*100);
  $('aRc').innerHTML=`<div class="kpis">
<div class="kpi"><b>${T.acq.toFixed(2)} h</b><span>RC généré total</span></div>
<div class="kpi"><b>${T.dec.toFixed(2)} h</b><span>RC pris / payé</span></div>
<div class="kpi ${rcSol>S.rcAlerte?'bad':rcSol>S.rcAlerte*0.6?'warn':''}"><b>${rcSol.toFixed(2)} h</b><span>Solde RC</span></div>
<div class="kpi ${rcSol>S.rcAlerte?'bad':''}"><b>${EUR(rcSol*S.taux)}</b><span>Valeur RC</span></div>
</div>
<div class="${rcSol>S.rcAlerte?'bar bad':'bar warn'}" style="margin-top:9px"><i style="width:${barPct.toFixed(1)}%"></i></div>
${rcSol>S.rcAlerte?`<div class="al b" style="margin-top:6px">🚨 Solde RC élevé (${rcSol.toFixed(1)}h / seuil ${S.rcAlerte}h) — risque de perdre des heures !</div>`:''}`;
  const crit=uniqueAlerts.filter(a=>a.lvl==='b');
  $('aAl').innerHTML=uniqueAlerts.length
    ?(crit.length?crit:uniqueAlerts).slice(0,50).map(a=>`<div class="al ${a.lvl}"><b>${shortY(a.k)}</b> — ${esc(a.m)}</div>`).join('')
    +(uniqueAlerts.length>50?`<div class="mut">… et ${uniqueAlerts.length-50} autres anomalies</div>`:'')
    :'<div class="al k">✅ Aucune anomalie sur les périodes enregistrées</div>';
}

function renderRegBase(){
  for(const g in RG)$(g).innerHTML=RG[g].map(([k,l])=>{
    const ty=['anchor','panDeb','panFin','nuitDeb','nuitFin'].includes(k)?
      (k==='anchor'?'date':'time'):'number';
    return `<div><label>${l}</label><input type="${ty}" step="any" value="${DB.s[k]??''}" onchange="DB.s['${k}']=this.type==='number'?parseFloat(this.value)||0:this.value;save();renderAll()"></div>`;
  }).join('');
  $('rMin').checked=DB.s.min;
  $('rNom').value=DB.s.nom||'';
  $('rEmb').value=DB.s.emb||'';
  $('rAnc').value=DB.s.anc||0;
  const anc=calcAnc(DB.s.emb||DEF.emb);
  const next=anc.y>=15?'plafond conventionnel atteint (8 %)':`prochain palier : ${anc.nextPct}% à ${anc.nextYears} ans`;
  $('rAncCalc').innerHTML=`<b>${anc.y} ans ${anc.m} mois</b> → <strong>${anc.pct}%</strong> d'ancienneté CCN · <span>${next}</span>`;
  $('rBk').innerHTML=DB.exp?'Dernier export : <b>'+DB.exp+'</b>':'<span style="color:var(--warn)">⚠️ Aucune sauvegarde</span>';
}

function renderAll(){
  renderHome();
  if(curTab==='jour')renderDay();
  if(curTab==='mois')renderMonth();
  if(curTab==='paie')renderPay();
  if(curTab==='audit')renderAudit();
  if(curTab==='bul')renderBulHist();
  if(curTab==='romi')renderRomiTab();
  if(curTab==='reg')renderReg();
  let tot=0;
  DB.periods.forEach(p=>{const{AL}=calcPer(p.start,p.nb);tot+=AL.filter(a=>a.lvl==='b').length});
  const badge=$('hBadge');
  if(tot>0){badge.style.display='';badge.textContent=tot}else badge.style.display='none';
  $('t-audit')?.querySelector('.tb')?.remove();
  if(tot>0){const auditTab=$('t-audit');if(auditTab){const sp=document.createElement('span');sp.className='tb';sp.textContent=tot;auditTab.appendChild(sp)}}
}

function wipe(){
  if(!confirm('⚠️ Effacer toutes les données locales MesHeures ?\n\nCette action supprime les journées, bulletins, relevés, constats et réglages enregistrés sur cet appareil.'))return;
  try{localStorage.removeItem(LS)}catch(e){}
  DB={s:{...DEF},days:{},cmp:{},periods:[],bul:{},bulletins:[],romi:{},per:{start:DEF.anchor,nb:1},exp:null};
  curDate=today();curMonth=curDate.slice(0,7);curTab='home';_undo=null;
  save();tab('home');
  alert('✅ Données locales effacées.');
}

function copySum(){
  const{Q,G}=calcPer(DB.per.start,DB.per.nb);
  let t='MesHeures — Résumé\n';
  t+='Période : '+short(DB.per.start)+' → '+short(addD(DB.per.start,DB.per.nb*14-1))+'\n\n';
  Q.forEach((o,i)=>{
    o.w.forEach((s,j)=>t+='Sem. '+(j+1)+' ('+short(s.start)+') : Amp '+F(s.amp)+' · TTE '+F(s.tte)+'\n');
    t+='→ Q'+(i+1)+' : TTE '+F(o.seuil)+' | HS 25% '+F(o.h25)+' · HS 50% '+F(o.h50)+'\n\n';
  });
  t+='TOTAL : TTE '+F(G.tte)+' · Amp '+F(G.amp)+' · '+G.trav+' j · '+(G.ir+G.iru)+' paniers · IDAJ '+C2(G.idaj)+'h';
  navigator.clipboard.writeText(t).then(()=>alert('✅ Résumé copié !'),()=>prompt('Copie :',t));
}

