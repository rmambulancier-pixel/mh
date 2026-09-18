/*
 * MesHeures V31.1.0 — ACCUEIL PREMIUM
 *
 * Nouveau renderer indépendant.
 * Le moteur V30 reste la source de vérité.
 * Smart Control n'est pas utilisé pour rendre l'Accueil.
 */

(function () {
  'use strict';

  const V = '31.1.0';

  const $ = id => document.getElementById(id);

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmt(v) {
    const n = Number(v);

    if (!Number.isFinite(n))
      return '—';

    if (typeof F === 'function')
      return F(Math.round(n));

    const m = Math.max(0, Math.round(n));

    return Math.floor(m / 60) +
      'h' +
      String(m % 60).padStart(2, '0');
  }

  function dateLabel(k) {
    try {
      return typeof shortY === 'function'
        ? shortY(k)
        : k;
    } catch (_) {
      return k;
    }
  }

  function dayLabel(k) {
    try {
      return typeof dow === 'function'
        ? dow(k).toUpperCase()
        : '';
    } catch (_) {
      return '';
    }
  }

  function dayData(k) {
    return window.DB?.days?.[k] || {
      t: 'REPOS',
      p: []
    };
  }

  function dayCalc(k) {
    try {
      if (
        window.MH30DataEngine &&
        typeof window.MH30DataEngine.day === 'function'
      ) {
        return window.MH30DataEngine.day(k) || {};
      }

      if (typeof cd === 'function')
        return cd(k) || {};
    } catch (_) {}

    return {};
  }

  function todayKey() {
    return typeof today === 'function'
      ? today()
      : new Date().toISOString().slice(0, 10);
  }

  function periodInfo() {
    try {
      const k = todayKey();
      const anchor = window.DB?.s?.anchor || k;

      if (
        window.MH30DataEngine &&
        typeof window.MH30DataEngine.period === 'function'
      ) {
        const diff = nDays(anchor, k);
        const start = addD(
          anchor,
          Math.floor(diff / 14) * 14
        );

        const result =
          window.MH30DataEngine.period(start, 1);

        const q = result?.Q?.[0] || {};
        const objective =
          Number(window.DB?.s?.base || 0) * 120;

        return {
          start,
          end: addD(start, 13),
          actual: Number(q.seuil || q.tte || 0),
          objective,
          h25: Number(q.h25 || 0),
          h50: Number(q.h50 || 0)
        };
      }

      if (typeof calcPer === 'function') {
        const diff = nDays(anchor, k);
        const start = addD(
          anchor,
          Math.floor(diff / 14) * 14
        );

        const result = calcPer(start, 1);
        const q = result?.Q?.[0] || {};

        return {
          start,
          end: addD(start, 13),
          actual: Number(q.seuil || q.tte || 0),
          objective:
            Number(window.DB?.s?.base || 0) * 120,
          h25: Number(q.h25 || 0),
          h50: Number(q.h50 || 0)
        };
      }
    } catch (_) {}

    return null;
  }

  function monthInfo() {
    try {
      const k = todayKey();

      if (typeof mhMonthStats === 'function')
        return mhMonthStats(k.slice(0, 7)) || {};
    } catch (_) {}

    return {};
  }

  function nextService() {
    const k = todayKey();

    const keys = Object.keys(window.DB?.days || {})
      .filter(x =>
        x > k &&
        ['T', 'NUIT'].includes(window.DB.days[x]?.t)
      )
      .sort();

    return keys.length
      ? {
          k: keys[0],
          d: window.DB.days[keys[0]]
        }
      : null;
  }

  function recentDays() {
    const out = [];
    const now = todayKey();

    for (let i = 6; i >= 0; i--) {
      const k = addD(now, -i);
      const d = dayData(k);
      const r = dayCalc(k);

      out.push({
        k,
        d,
        r
      });
    }

    return out;
  }


  function weekInfo(days) {
    const work = days.filter(x => ['T','NUIT'].includes(x.d?.t));
    const tte = work.reduce((s,x) => s + Number(x.r?.tte || 0), 0);
    const amp = work.reduce((s,x) => s + Number(x.r?.amp || 0), 0);
    return {
      days,
      workCount: work.length,
      tte,
      avgAmp: work.length ? amp / work.length : 0
    };
  }

  function homeAlerts(d, r, active) {
    const out = [];

    if (['T','NUIT'].includes(d?.t) && d.deb && !d.fin && !active)
      out.push({
        icon:'⚠️',
        title:'Journée à compléter',
        text:'Une heure de fin manque pour aujourd’hui.',
        action:'jour'
      });

    if (['T','NUIT'].includes(d?.t) && Number(r?.amp || 0) >= 720)
      out.push({
        icon:'⏱',
        title:'Amplitude élevée',
        text:'Vérifie cette journée dans la saisie.',
        action:'jour'
      });

    if (
      ['T','NUIT'].includes(d?.t) &&
      Number(r?.pz || 0) === 0 &&
      Number(r?.tte || 0) >= 360 &&
      !active
    )
      out.push({
        icon:'☕',
        title:'Pause à vérifier',
        text:'Aucune pause n’est actuellement comptabilisée.',
        action:'jour'
      });

    return out;
  }

  function serviceType(d) {
    if (d?.t === 'T')
      return 'SERVICE';

    if (d?.t === 'NUIT')
      return 'SERVICE DE NUIT';

    if (d?.t === 'CP')
      return 'CONGÉ';

    if (d?.t === 'MAL')
      return 'MALADIE';

    if (d?.t === 'RC')
      return 'REPOS COMPENSATEUR';

    return 'REPOS';
  }

  function liveToggle() {
    try {
      if (window.MH30Live?.toggle)
        window.MH30Live.toggle();

      setTimeout(() => renderLive(), 60);
    } catch (_) {}
  }

  window.mhV31ToggleLive = liveToggle;

  function renderLive() {
    const k = todayKey();
    const d = dayData(k);
    const r = dayCalc(k);

    const active =
      !!window.MH30Live?.active?.();

    const clock =
      active && window.MH30Live?.elapsedClock
        ? window.MH30Live.elapsedClock()
        : fmt(r.tte);

    document
      .querySelectorAll('[data-v31-clock]')
      .forEach(x => x.textContent = clock);

    document
      .querySelectorAll('[data-v31-state]')
      .forEach(x => {
        x.textContent =
          active
            ? 'EN SERVICE'
            : serviceType(d);
      });

    document
      .querySelectorAll('[data-v31-start]')
      .forEach(x =>
        x.textContent = d.deb || '—'
      );

    document
      .querySelectorAll('[data-v31-end]')
      .forEach(x =>
        x.textContent =
          active
            ? 'En cours'
            : d.fin || '—'
      );

    document
      .querySelectorAll('[data-v31-pause]')
      .forEach(x =>
        x.textContent = fmt(r.pz)
      );

    document
      .querySelectorAll('[data-v31-amp]')
      .forEach(x =>
        x.textContent = fmt(r.amp)
      );

    document
      .querySelectorAll('[data-v31-live-button]')
      .forEach(x => {
        x.textContent =
          active
            ? '■ Arrêter'
            : '▶ Démarrer';
        x.classList.toggle('stop', active);
      });
  }

  function monthProjection() {
    const now = todayKey();
    const month = now.slice(0, 7);
    const days = Object.keys(window.DB?.days || {})
      .filter(k => k.slice(0, 7) === month)
      .sort();

    const past = days.filter(k => k <= now);
    const future = days.filter(k =>
      k > now && ['T', 'NUIT'].includes(window.DB.days[k]?.t)
    );

    const worked = past.filter(k =>
      ['T', 'NUIT'].includes(window.DB.days[k]?.t)
    );

    const tte = worked.reduce((sum, k) =>
      sum + Number(dayCalc(k)?.tte || 0), 0
    );

    const avg = worked.length ? tte / worked.length : 0;
    const projected = worked.length
      ? tte + avg * future.length
      : 0;

    return {
      tte,
      avg,
      worked: worked.length,
      future: future.length,
      projected,
      confidence: worked.length >= 5
        ? 'Bonne base'
        : worked.length > 0
          ? 'Base partielle'
          : 'En attente de données'
    };
  }

  function dossierHealth() {
    const now = todayKey();
    const month = now.slice(0, 7);
    let complete = 0;
    let toCheck = 0;
    let critical = 0;

    Object.keys(window.DB?.days || {})
      .filter(k => k.slice(0, 7) === month && k <= now)
      .forEach(k => {
        const d = dayData(k);
        if (!['T', 'NUIT'].includes(d?.t)) return;

        const r = dayCalc(k);
        const active = k === now && !!window.MH30Live?.active?.();

        if (d.deb && !d.fin && !active) {
          toCheck++;
          return;
        }

        if (Number(r?.amp || 0) >= 900) {
          critical++;
          return;
        }

        if (d.deb && d.fin) complete++;
      });

    return { complete, toCheck, critical };
  }

  function smartInsight(proj, health) {
    try {
      const intel = window.mhV30IntelligenceData?.();
      const p = intel?.projection || {};
      if (p.firstRisk) {
        return {
          icon: '⚠️',
          title: 'Point de vigilance',
          text: 'Une trajectoire à surveiller apparaît dans Intelligence.',
          action: 'analyse'
        };
      }
    } catch (_) {}

    if (health.critical)
      return {
        icon: '🔴',
        title: 'Vérification prioritaire',
        text: health.critical + ' journée(s) présentent une amplitude très élevée.',
        action: 'audit'
      };

    if (health.toCheck)
      return {
        icon: '🟠',
        title: 'Donnée à compléter',
        text: health.toCheck + ' journée(s) du mois restent incomplètes.',
        action: 'jour'
      };

    if (proj.future > 0 && proj.avg > 0)
      return {
        icon: '🔮',
        title: 'Trajectoire calculée',
        text: 'La projection utilise tes journées enregistrées et les services déjà planifiés.',
        action: 'analyse'
      };

    return {
      icon: '✓',
      title: 'Dossier propre',
      text: 'Aucune anomalie prioritaire détectée sur les données connues.',
      action: 'audit'
    };
  }

  function renderHome() {
    const host = $('s-home');
    if (!host) return;

    try {

    const k = todayKey();
    const d = dayData(k);
    const r = dayCalc(k);
    const next = nextService();
    const proj = monthProjection();
    const health = dossierHealth();
    const insight = smartInsight(proj, health);
    const active = !!window.MH30Live?.active?.();

    const monthRemaining = Math.max(
      0,
      new Date(
        Number(k.slice(0, 4)),
        Number(k.slice(5, 7)),
        0
      ).getDate() - Number(k.slice(8, 10))
    );

    const html = [];

    html.push(
      '<div class="mh31-home">',

      '<header class="mh31-head">',
      '<div class="mh31-brand">',
      '<div class="mh31-logo">⏱</div>',
      '<div>',
      '<span>MESHEURES</span><strong>V31</strong>',
      '<h1>Tableau de bord</h1>',
      '<small>' + esc(dateLabel(k)) + ' · ' + esc(dayLabel(k)) + '</small>',
      '</div></div>',
      '<button class="mh31-settings" onclick="tab(\'reg\')" aria-label="Réglages">⚙</button>',
      '</header>',

      '<section class="mh31-hero">',
      '<div class="mh31-hero-top">',
      '<div><span>AUJOURD’HUI</span><b data-v31-state>' +
        esc(active ? 'EN SERVICE' : serviceType(d)) +
      '</b></div>',
      '<button class="mh31-live-button" data-v31-live-button onclick="mhV31ToggleLive()">' +
        (active ? '■ Arrêter' : '▶ Démarrer') +
      '</button>',
      '</div>',
      '<div class="mh31-clock" data-v31-clock>' + fmt(r.tte) + '</div>',
      '<div class="mh31-caption">Temps de travail effectif</div>',
      '<div class="mh31-meta">',
      '<div><span>Début</span><b data-v31-start>' + esc(d.deb || '—') + '</b></div>',
      '<div><span>Fin</span><b data-v31-end>' + esc(active ? 'En cours' : d.fin || '—') + '</b></div>',
      '<div><span>Pause</span><b data-v31-pause>' + fmt(r.pz) + '</b></div>',
      '<div><span>Amplitude</span><b data-v31-amp>' + fmt(r.amp) + '</b></div>',
      '</div></section>',

      '<section class="mh31-actions">',
      '<button onclick="tab(\'jour\')"><b>＋</b><span>Saisie</span><small>Journée & pauses</small></button>',
      '<button onclick="tab(\'mois\')"><b>▦</b><span>Planning</span><small>Calendrier</small></button>',
      '<button onclick="tab(\'paie\')"><b>€</b><span>Paie</span><small>Heures & HS</small></button>',
      '<button onclick="tab(\'analyse\')"><b>◌</b><span>Analyse</span><small>Suivi</small></button>',
      '</section>',

      '<section class="mh31-command">',
      '<div class="mh31-command-head"><div><span>PILOTAGE</span><b>Où en est ton mois ?</b></div>',
      '<span class="mh31-command-badge">' + monthRemaining + ' j restants</span></div>',
      '<div class="mh31-command-grid">',
      '<div class="mh31-command-card"><span>PROJECTION</span><strong>' +
        (proj.projected ? fmt(proj.projected) : '—') +
      '</strong><small>fin de mois au rythme actuel</small></div>',
      '<div class="mh31-command-card"><span>RYTHME MOYEN</span><strong>' +
        (proj.avg ? fmt(proj.avg) : '—') +
      '</strong><small>par journée travaillée</small></div>',
      '<div class="mh31-command-card"><span>SERVICES PLANIFIÉS</span><strong>' +
        proj.future +
      '</strong><small>restant(s) ce mois-ci</small></div>',
      '</div>',
      '<div class="mh31-command-foot"><span>' +
        proj.worked + ' journée(s) comptabilisée(s)' +
      '</span><span>' + esc(proj.confidence) + '</span></div>',
      '</section>',

      '<section class="mh31-intelligence">',
      '<div class="mh31-intel-top"><div><span>INTELLIGENCE</span><b>' +
        esc(insight.title) +
      '</b></div><strong>' + insight.icon + '</strong></div>',
      '<p>' + esc(insight.text) + '</p>',
      '<button onclick="tab(\'' + esc(insight.action) + '\')">Ouvrir le détail <em>›</em></button>',
      '</section>',

      '<section class="mh31-health">',
      '<div class="mh31-health-head"><div><span>ÉTAT DU DOSSIER</span><b>' +
        ((health.toCheck || health.critical)
          ? 'Vérification nécessaire'
          : 'Données cohérentes') +
      '</b></div><strong class="' +
        ((health.toCheck || health.critical) ? 'warn' : 'ok') +
      '">' + (health.toCheck + health.critical) + '</strong></div>',
      '<div class="mh31-health-row">',
      '<span>✓ ' + health.complete + ' complète(s)</span>',
      '<span>⚠ ' + health.toCheck + ' à compléter</span>',
      '<span>! ' + health.critical + ' critique(s)</span>',
      '</div>',
      '<button onclick="tab(\'audit\')">Contrôler les données <em>›</em></button>',
      '</section>',

      '<section class="mh31-next-command">',
      '<div class="mh31-title"><div><span>PROCHAINE ACTION</span><b>' +
        (next ? 'Service planifié' : 'Rien à préparer') +
      '</b></div><button onclick="tab(\'mois\')">Planning ›</button></div>',

      next
        ? '<button class="mh31-next" onclick="mhOpenDay(\'' + esc(next.k) + '\')">' +
          '<div class="mh31-next-date"><strong>' +
          new Date(next.k + 'T12:00:00').getDate() +
          '</strong><span>' + esc(dayLabel(next.k)) +
          '</span></div>' +
          '<div><b>' + esc(dateLabel(next.k)) + '</b><small>' +
          esc(next.d?.deb || 'Horaire à définir') +
          (next.d?.fin ? ' → ' + esc(next.d.fin) : '') +
          '</small></div><em>›</em></button>'
        : '<div class="mh31-empty">Aucune journée future planifiée dans les données connues.</div>',

      '</section>',

      '<section class="mh31-footer-actions">',
      '<button onclick="tab(\'jour\')">＋ Ajouter une journée</button>',
      '<button onclick="tab(\'reg\')">⚙ Réglages</button>',
      '</section>',

      '</div>'
    );

    host.innerHTML = html.join('');
    renderLive();
    if (window.MH30Live?.render) window.MH30Live.render();

    } catch (e) {
      console.error('MesHeures V31 HOME ERROR:', e);

      host.innerHTML =
        '<div class="mh31-home">' +
        '<section class="mh31-intelligence">' +
        '<div class="mh31-intel-top">' +
        '<div><span>MESHEURES V31</span><b>Accueil en récupération</b></div>' +
        '<strong>⚠️</strong>' +
        '</div>' +
        '<p>Le moteur V31 a rencontré une erreur au démarrage.</p>' +
        '<button onclick="location.reload()">Recharger <em>↻</em></button>' +
        '</section>' +
        '</div>';
    }
  }

  /*
   * V31 devient le renderer de l'Accueil.
   * Smart Control reste présent dans le projet,
   * mais ne possède plus l'Accueil.
   */
  function install() {

    window.__MH_HOME_OWNER = 'V31_HOME';

    window.renderHome = renderHome;

    if (window.MH302) {
      window.MH302.renderHome = renderHome;
    }

    document.documentElement.dataset.mhVersion = V;

    const version =
      $('mhVersion');

    if (version)
      version.textContent = 'V31.1.0';

    document.title =
      'MesHeures V31.1.0';

    if (
      window.curTab === 'home' ||
      !window.curTab
    ) {
      renderHome();
    }
  }

  /*
   * Le renderer Smart Control possède encore un timer
   * historique de 100 ms. On installe donc V31 juste
   * après lui, puis on devient la source définitive.
   */
  setTimeout(install, 250);
  setTimeout(install, 600);

  document.addEventListener(
    'mh:state-changed',
    () => {
      if (
        (window.curTab || 'home') === 'home'
      ) {
        setTimeout(renderHome, 30);
      }
    }
  );

  window.MH31 = {
    version: V,
    renderHome,
    renderLive
  };

})();
