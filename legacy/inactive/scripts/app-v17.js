/* MesHeures V18 — interface, projection, conformité et migrations */
(function(){
  const V='18.0.13';
  function migrate(){
    DB.s=DB.s||{};
    if(DB.s.taux===14.02)DB.s.taux=14.20;
    if(!DB.s.theme)DB.s.theme='auto';
    DB.s.v17=V;
    save();
  }
  function theme(t){
    t=t||DB.s.theme||'auto';DB.s.theme=t;save();
    const root=document.documentElement;
    const resolved=t==='auto'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;
    root.dataset.theme=resolved;
    root.style.colorScheme=resolved;
    const meta=document.querySelector('meta[name=theme-color]');
    if(meta)meta.setAttribute('content',resolved==='light'?'#f5f7f9':'#0d1117');
  }
  function buildNav(){
    if(document.getElementById('mhV17Nav'))return;
    const nav=document.createElement('nav');nav.id='mhV17Nav';nav.className='mh-v17-nav';
    nav.innerHTML=`<button onclick="tab('home')">⌂<span>Accueil</span></button><button onclick="tab('jour')">＋<span>Saisie</span></button><button onclick="tab('mois')">▣<span>Planning</span></button><button onclick="tab('paie')">€<span>Paie</span></button><button onclick="mhV17Menu()">☰<span>Outils</span></button>`;
    document.body.appendChild(nav);
    const menu=document.createElement('div');menu.id='mhV17Menu';menu.className='mh-v17-menu';menu.innerHTML=`<div class="mh-v17-sheet"><div class="mh-v17-sheet-head"><b>MesHeures V18</b><button class="g" onclick="mhV17Menu()">✕</button></div><div class="mh-v17-tools"><button onclick="tab('audit');mhV17Menu()">🛡️ Audit</button><button onclick="tab('bul');mhV17Menu()">📄 Bulletin</button><button onclick="tab('romi');mhV17Menu()">📋 ROMI1</button><button onclick="mhV17Legal();mhV17Menu()">⚖️ Contrôle légal</button><button onclick="tab('reg');mhV17Menu()">⚙️ Réglages</button><button onclick="mhV17BackupPanel();mhV17Menu()">💾 Sauvegardes</button></div><div class="mh-v17-theme"><b>Apparence</b><div><button onclick="mhV17Theme('auto')">📱 Auto</button><button onclick="mhV17Theme('dark')">🌙 Sombre</button><button onclick="mhV17Theme('light')">☀️ Clair</button></div></div></div>`;document.body.appendChild(menu);
  }
  window.mhV17Menu=function(){document.getElementById('mhV17Menu')?.classList.toggle('on')};
  window.mhV17Theme=theme;
  function injectHome(){
    const h=document.getElementById('homeQuat');if(!h||document.getElementById('mhV17Projection'))return;
    const c=document.createElement('div');c.id='mhV17Projection';c.className='card mh-v17-projection';c.innerHTML='<h2>🔮 Projection intelligente</h2><div id="mhV17ProjOut"></div>';h.closest('.dash-panel')?.after(c);
  }
  function renderProjection(){
    const el=document.getElementById('mhV17ProjOut');if(!el)return;
    const p=window.mhProjection?.(DB.per.start,DB.per.nb||1);if(!p)return;
    const state=p.margin<0?'bad':p.unknownDays?'warn':'ok';
    el.innerHTML=`<div class="mh-v17-proj-grid"><div><span>Réalisé</span><b>${F(p.actual)}</b></div><div><span>Planifié</span><b>${F(p.planned)}</b></div><div><span>Projection</span><b class="${state}">${F(p.projected)}</b></div></div><div class="mh-v17-proj-note">${p.plannedDays} journée(s) future(s) planifiée(s) · ${p.estimatedDays} estimée(s) par moyenne · ${p.unknownDays} non renseignée(s).</div>${p.unknownDays?'<div class="al w">🟠 Projection partielle : les journées futures non renseignées ne sont pas inventées.</div>':''}${p.margin<0?`<div class="al b">🔴 Dépassement projeté : ${F(-p.margin)} au-dessus du seuil de ${F(p.threshold)}.</div>`:`<div class="al k">🟢 Marge projetée : ${F(p.margin)} avant le seuil.</div>`}`;
  }
  function patchHome(){
    if(window.__mhV17Home)return;window.__mhV17Home=true;const old=window.renderHome;window.renderHome=function(){old();injectHome();renderProjection();};
  }
  window.mhV17Legal=function(){
    const start=DB.per.start,nb=DB.per.nb||1,al=window.mhLegalAudit?.(start,nb)||[];
    const box=document.createElement('div');box.className='mh-v17-overlay';box.innerHTML=`<div class="mh-v17-dialog"><div class="mh-v17-sheet-head"><b>⚖️ Contrôle légal V17</b><button class="g" onclick="this.closest('.mh-v17-overlay').remove()">✕</button></div><p class="mut">Référentiel vérifié le 11/09/2026 · ${MH_LEGAL.ccn}</p><div class="mh-v17-legal-list">${al.length?al.map(a=>`<div class="al ${a.lvl}"><b>${a.k}</b> — ${esc(a.m)}<small>${esc(a.rule||'')}</small></div>`).join(''):'<div class="al k">✅ Aucun écart détecté par les contrôles V17 sur la période.</div>'}</div><hr><div class="mut">Minima ambulanciers : N1 ${MH_LEGAL.rules.ccnMin.n1.toFixed(2)} € · N2 ${MH_LEGAL.rules.ccnMin.n2.toFixed(2)} € · N3 ${MH_LEGAL.rules.ccnMin.n3.toFixed(2)} €. SMIC : ${MH_LEGAL.rules.smic.value.toFixed(2)} €.</div></div></div>`;document.body.appendChild(box);
  };
  window.mhV17BackupPanel=function(){
    const list=window.mhV17ListBackups?.()||[];
    const status=window.mhV17BackupStatus?.()||{count:list.length,last:''};
    const box=document.createElement('div');box.className='mh-v17-overlay';
    box.innerHTML=`<div class="mh-v17-dialog">
      <div class="mh-v17-sheet-head"><b>💾 Sauvegarde renforcée V18.0.13</b><button class="g" onclick="this.closest('.mh-v17-overlay').remove()">✕</button></div>
      <div class="al i"><b>${status.count}</b> point(s) local(aux) conservé(s) · ${status.last?'dernier : '+new Date(status.last).toLocaleString('fr-FR'):'aucun point encore créé'}<br>Les nouveaux points sont conservés localement. Un export JSON permet une copie hors du téléphone.</div>
      <div class="row">
        <button onclick="const r=mhV17Backup('manual');if(r.ok){alert('✅ Point de restauration créé.');this.closest('.mh-v17-overlay').remove();mhV17BackupPanel()}else alert('❌ '+r.error)">💾 Créer un point maintenant</button>
        <button class="g" onclick="mhV17Export()">⬇ Export JSON complet</button>
        <button class="g" onclick="document.getElementById('mhV17Import').click()">⬆ Import JSON</button>
        <input id="mhV17Import" type="file" accept=".json,application/json" style="display:none" onchange="mhV17Import(this)">
      </div>
      <div class="row" style="margin-top:7px">
        <button class="g" onclick="if(typeof mhV18EncryptedBackup==='function')mhV18EncryptedBackup();else alert('Le backup chiffré V18 est indisponible sur cet écran.')">🔐 Export chiffré</button>
      </div>
      <div class="al i">Avant chaque import/restauration, MesHeures crée automatiquement un point de sécurité. Jusqu’à 5 points locaux V18 sont conservés. Les anciens points V17 restent restaurables.</div>
      <div>${list.length?list.map(x=>`<div class="mh-v17-back"><span>💾 ${new Date(x.date).toLocaleString('fr-FR')} · ${x.version}</span><button class="g" onclick="if(mhV17Restore('${x.key}'))this.closest('.mh-v17-overlay').remove()">Restaurer</button></div>`).join(''):'<div class="mut">Aucun point de restauration local.</div>'}</div>
    </div></div>`;
    document.body.appendChild(box);
  };
  function addReg(){
    const host=document.getElementById('rBk');if(!host||document.getElementById('mhV17Reg'))return;
    const c=document.createElement('div');c.id='mhV17Reg';c.className='mh-v17-reg';c.innerHTML='<b>V18 · sauvegarde renforcée</b><div class="row" style="margin-top:7px"><button class="g" onclick="mhV17BackupPanel()">💾 Ouvrir le centre de sauvegarde</button><button class="g" onclick="mhV17Export()">⬇ Export JSON complet</button></div><small>Dernière sauvegarde : <span id="mhV17Last">—</span></small>';host.appendChild(c);const st=window.mhV17BackupStatus?.()||{};document.getElementById('mhV17Last').textContent=st.last?new Date(st.last).toLocaleString('fr-FR'):'aucune';
  }
  function legalCard(){
    const sec=document.getElementById('s-paie');if(!sec||document.getElementById('mhV17LegalCard'))return;
    const c=document.createElement('div');c.id='mhV17LegalCard';c.className='card';c.innerHTML='<h2>⚖️ Conformité V18 <span class="sub">référentiel 11/09/2026</span></h2><div class="kpis"><div class="kpi"><b>12 h</b><span>amplitude principe</span></div><div class="kpi"><b>14 h</b><span>extension max contrôlée</span></div><div class="kpi"><b>48 h</b><span>max semaine</span></div><div class="kpi"><b>46 h</b><span>moyenne 12 semaines</span></div></div><button class="b" style="margin-top:9px;width:100%" onclick="mhV17Legal()">⚖️ Lancer le contrôle de la période</button>';sec.insertBefore(c,sec.children[2]||null);
  }
  function patchRender(){
    if(window.__mhV17Render)return;window.__mhV17Render=true;const old=window.renderAll;window.renderAll=function(){old();addReg();legalCard();injectHome();renderProjection();};
  }
  function boot(){migrate();theme(DB.s.theme);if(document.getElementById('mhVersion'))document.getElementById('mhVersion').textContent='V18.0.13';buildNav();patchHome();patchRender();addReg();legalCard();injectHome();setTimeout(()=>{try{renderAll()}catch(e){console.error(e)}},0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if(DB.s.theme==='auto')theme('auto')});
})();
