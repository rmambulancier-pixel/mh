#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

ROOT="$HOME/MesHeures"
cd "$ROOT"

echo "=============================================="
echo " MESHEURES V30.2.0 — SMART CONTROL"
echo "=============================================="

fail() {
  echo
  echo "❌ ARRÊT : $1"
  echo
  git status --short || true
  exit 1
}

trap 'fail "Erreur ligne $LINENO"' ERR

# ------------------------------------------------
# 1. BASE
# ------------------------------------------------

echo
echo "▶ 1/9 — Vérification de la base"

[ "$(git branch --show-current)" = "v30.0.2-clean" ] \
  || fail "Mauvaise branche"

git diff --quiet \
  || fail "Le dépôt contient déjà des modifications locales"

test -f VERSION
test -f version.properties
test -f app/src/main/assets/web/index.html
test -f app/src/main/assets/web/scripts/app-v30.js
test -f app/src/main/assets/web/style/v30.css
test -f app/src/main/assets/web/sw.js

echo "✓ Base V30.1 propre"

# ------------------------------------------------
# 2. TAG DE SÉCURITÉ
# ------------------------------------------------

echo
echo "▶ 2/9 — Point de retour V30.1"

if ! git rev-parse v30.1.0-before-smart-control >/dev/null 2>&1; then
  git tag -a v30.1.0-before-smart-control \
    -m "MesHeures V30.1.0 stable before Smart Control"
fi

echo "✓ Tag de sécurité présent"

# ------------------------------------------------
# 3. VERSION
# ------------------------------------------------

echo
echo "▶ 3/9 — Passage V30.2.0"

printf '30.2.0\n' > VERSION

cat > version.properties <<'EOF'
VERSION=30.2.0
VERSION_CODE=3020
EOF

python3 - <<'PY'
from pathlib import Path

targets = [
    Path("app/src/main/assets/web/scripts/app-v30.js"),
    Path("app/src/main/assets/web/index.html"),
    Path("app/src/main/assets/web/sw.js"),
]

for p in targets:
    if not p.exists():
        continue

    s = p.read_text(encoding="utf-8")
    s = s.replace("30.1.0", "30.2.0")
    p.write_text(s, encoding="utf-8")

print("✓ Sources web synchronisées")
PY

# ------------------------------------------------
# 4. SMART CONTROL
# ------------------------------------------------

echo
echo "▶ 4/9 — Installation du module Smart Control"

cat > app/src/main/assets/web/scripts/app-v30-smart.js <<'JS'
/*
 * MesHeures V30.2.0 — SMART CONTROL
 *
 * Couche cockpit / insights.
 * Le moteur existant reste la source de vérité.
 */

(function () {
  'use strict';

  const V = '30.2.0';
  const PRIMARY = ['home', 'jour', 'mois', 'paie', 'analyse'];

  const $ = id => document.getElementById(id);

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(min) {
    if (!Number.isFinite(Number(min))) return '—';
    if (typeof F === 'function') return F(Math.round(Number(min)));
    const n = Math.max(0, Math.round(Number(min)));
    return Math.floor(n / 60) + 'h' +
      String(n % 60).padStart(2, '0');
  }

  function money(n) {
    if (!Number.isFinite(Number(n))) return '—';
    return Number(n).toFixed(2).replace('.', ',') + ' €';
  }

  function work(k) {
    return ['T', 'NUIT'].includes(DB?.days?.[k]?.t);
  }

  function average(values) {
    const a = values.filter(Number.isFinite);
    if (!a.length) return 0;
    return Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  }

  function minutesOf(k) {
    try {
      const r = cd(k);
      return Math.max(0, Number(r?.tte) || 0);
    } catch (_) {
      return 0;
    }
  }

  function timeToMinutes(v) {
    if (!/^\d{1,2}:\d{2}$/.test(String(v || ''))) return null;
    const [h, m] = String(v).split(':').map(Number);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  function smartTime(v) {
    v = String(v || '').trim().replace(/\s+/g, '');

    if (/^\d{1,2}$/.test(v)) {
      const h = Number(v);
      if (h <= 23)
        return String(h).padStart(2, '0') + ':00';
    }

    if (/^\d{3,4}$/.test(v)) {
      v = v.padStart(4, '0');

      const h = Number(v.slice(0, -2));
      const m = Number(v.slice(-2));

      if (h <= 23 && m <= 59)
        return String(h).padStart(2, '0') + ':' +
               String(m).padStart(2, '0');
    }

    return v;
  }

  function recentRows(days) {
    const out = [];

    for (let i = 0; i < days; i++) {
      const k = addD(today(), -i);

      if (!work(k)) continue;

      try {
        out.push({
          k,
          d: DB.days[k],
          r: cd(k)
        });
      } catch (_) {}
    }

    return out;
  }

  // ---------------------------------------------
  // INSIGHTS
  // ---------------------------------------------

  function insights() {
    const rows = recentRows(28);

    const tte = rows
      .map(x => Number(x.r?.tte))
      .filter(x => x > 0);

    const amp = rows
      .map(x => Number(x.r?.amp))
      .filter(x => x > 0);

    const pause = rows
      .map(x => Number(x.r?.pz))
      .filter(x => x >= 0);

    const starts = rows
      .map(x => timeToMinutes(x.d?.deb))
      .filter(x => x != null);

    const ends = rows
      .map(x => timeToMinutes(x.d?.fin))
      .filter(x => x != null);

    const month = today().slice(0, 7);

    const monthTte = Object.keys(DB.days || {})
      .filter(k => k.startsWith(month) && work(k))
      .map(minutesOf)
      .filter(x => x > 0);

    const weekTte = [];

    for (let i = 0; i < 7; i++) {
      const k = addD(today(), -i);
      if (work(k)) {
        const m = minutesOf(k);
        if (m > 0) weekTte.push(m);
      }
    }

    const avgTte = average(tte);
    const avgAmp = average(amp);
    const avgPause = average(pause);
    const avgStart = average(starts);
    const avgEnd = average(ends);

    const monthAvg = average(monthTte);
    const weekAvg = average(weekTte);

    return {
      count: rows.length,
      avgTte,
      avgAmp,
      avgPause,
      avgStart,
      avgEnd,
      monthAvg,
      weekAvg,
      delta:
        weekAvg && monthAvg
          ? weekAvg - monthAvg
          : null
    };
  }

  function hhmm(m) {
    if (!Number.isFinite(Number(m))) return '—';

    m = Math.round(Number(m));

    return String(Math.floor(m / 60)).padStart(2, '0') +
      ':' +
      String(m % 60).padStart(2, '0');
  }

  // ---------------------------------------------
  // ANOMALIES
  // ---------------------------------------------

  function anomalies() {
    const rows = recentRows(28);
    const out = [];

    const amplitudes = rows
      .map(x => Number(x.r?.amp))
      .filter(x => x > 0);

    const personalAverage = average(amplitudes);

    rows.forEach(({ k, d, r }) => {

      if (!d?.deb || !d?.fin) {
        out.push({
          level: 'warn',
          k,
          title: 'Journée incomplète',
          text: 'Début ou fin manquant.'
        });
        return;
      }

      const tte = Number(r?.tte) || 0;
      const pause = Number(r?.pz) || 0;

      if (tte <= 0) {
        out.push({
          level: 'warn',
          k,
          title: 'TTE non calculé',
          text: 'Le moteur ne retourne pas de TTE pour cette journée.'
        });
      }

      if (tte >= 360 && pause < 20) {
        out.push({
          level: 'warn',
          k,
          title: 'Pause à vérifier',
          text: 'Moins de 20 min de pause détectées par le moteur.'
        });
      }

      const amp = Number(r?.amp) || 0;

      if (
        personalAverage > 0 &&
        amp > personalAverage + 60
      ) {
        out.push({
          level: 'info',
          k,
          title: 'Amplitude inhabituelle',
          text:
            fmt(amp) +
            ' contre ' +
            fmt(personalAverage) +
            ' de moyenne récente.'
        });
      }

      if (Array.isArray(r?.al)) {
        r.al.slice(0, 2).forEach(a => {
          out.push({
            level: a?.lvl === 'b' ? 'bad' : 'warn',
            k,
            title: 'Contrôle du moteur',
            text: a?.m || 'Contrôle à vérifier.'
          });
        });
      }
    });

    return out;
  }

  // ---------------------------------------------
  // PAIE — UNIQUEMENT MOTEUR EXISTANT
  // ---------------------------------------------

  function payroll() {
    try {
      if (typeof calcPer !== 'function') return null;

      const p = DB.per || {};

      const start =
        p.start ||
        DB.s?.anchor ||
        today();

      const nb = Math.max(
        2,
        Math.min(3, Number(p.nb) || 2)
      );

      const result = calcPer(start, nb);
      const G = result?.G || {};

      let gross = null;

      if (typeof brutOf === 'function') {
        try {
          const b = brutOf(G);
          gross = Number.isFinite(Number(b?.tot))
            ? Number(b.tot)
            : null;
        } catch (_) {}
      }

      return {
        start,
        nb,
        tte: Number(G.tte) || 0,
        h25: Number(G.h25) || 0,
        h50: Number(G.h50) || 0,
        trav: Number(G.trav) || 0,
        gross
      };

    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------
  // QUATORZAINE
  // ---------------------------------------------

  function period() {
    try {
      if (typeof calcPer !== 'function') return null;

      const anchor = DB.s?.anchor || today();
      const diff = nDays(anchor, today());

      const start = addD(
        anchor,
        Math.floor(diff / 14) * 14
      );

      const result = calcPer(start, 1);
      const q = result?.Q?.[0];

      if (!q) return null;

      const objective =
        Number(DB.s?.base || 35) * 120;

      const actual = Number(q.tte) || 0;

      return {
        start,
        end: addD(start, 13),
        actual,
        objective,
        gap: objective - actual
      };

    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------
  // CALENDRIER
  // ---------------------------------------------

  function dayStatus(k) {
    const d = DB.days?.[k];

    if (!d)
      return ['empty', '⚪', 'Aucune donnée'];

    if (['REPOS', 'RC'].includes(d.t))
      return ['rest', '🔵', 'Repos'];

    if (['CP', 'MAL'].includes(d.t))
      return [
        'leave',
        '🟡',
        d.t === 'CP' ? 'Congé' : 'Maladie'
      ];

    if (work(k)) {
      const r = cd(k);

      if (!d.deb || !d.fin || !(Number(r?.tte) > 0))
        return ['warn', '🟡', 'Incomplète'];

      if (
        Array.isArray(r?.al) &&
        r.al.some(a => a?.lvl === 'b')
      )
        return ['bad', '🔴', 'Anomalie'];

      return ['ok', '🟢', 'Complète'];
    }

    return ['empty', '⚪', 'Aucune donnée'];
  }

  function calendar() {
    let html = '';

    for (let i = 13; i >= 0; i--) {
      const k = addD(today(), -i);
      const [cls, icon, label] = dayStatus(k);

      let tte = '';

      if (work(k)) {
        const m = minutesOf(k);
        if (m > 0) tte = fmt(m);
      }

      html += `
        <button
          class="mh302-cal-day ${cls}"
          onclick="mhOpenDay('${esc(k)}')"
          title="${esc(label)}">
          <b>${icon}</b>
          <strong>${new Date(k + 'T12:00:00').getDate()}</strong>
          <small>${tte || esc(label)}</small>
        </button>`;
    }

    return html;
  }

  // ---------------------------------------------
  // COCKPIT
  // ---------------------------------------------

  function renderHome() {
    const host = $('s-home');
    if (!host) return;

    const k = today();
    const d = DB.days?.[k] || {};
    const r = cd(k);

    const p = period();
    const ins = insights();
    const alerts = anomalies();
    const pay = payroll();

    const watch = alerts.slice(0, 2);

    host.innerHTML = `
      <div class="mh302-shell">

        <header class="mh302-head">
          <div>
            <span>MESHEURES · SMART CONTROL</span>
            <h1>Pilotage</h1>
            <small>${esc(k)}</small>
          </div>

          <button
            class="mh302-settings"
            onclick="tab('reg')"
            aria-label="Réglages">
            ⚙
          </button>
        </header>

        <section class="mh302-hero">

          <div class="mh302-hero-top">
            <div>
              <small>AUJOURD’HUI</small>
              <b>${work(k) ? 'SERVICE' : 'PAS DE SERVICE'}</b>
            </div>
          </div>

          <strong>${fmt(Number(r?.tte) || 0)}</strong>

          <div class="mh302-inline">
            <span>
              Début
              <b>${esc(d.deb || '—')}</b>
            </span>

            <span>
              Fin
              <b>${esc(d.fin || '—')}</b>
            </span>

            <span>
              Pause
              <b>${fmt(Number(r?.pz) || 0)}</b>
            </span>

            <span>
              Amplitude
              <b>${fmt(Number(r?.amp) || 0)}</b>
            </span>
          </div>

        </section>

        <section class="mh302-grid">

          <article>
            <small>QUATORZAINE</small>
            <strong>${p ? fmt(p.actual) : '—'}</strong>
            <span>
              objectif ${p ? fmt(p.objective) : '—'}
            </span>

            <div class="mh302-progress">
              <i style="width:${
                p && p.objective
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        p.actual / p.objective * 100
                      )
                    )
                  : 0
              }%"></i>
            </div>

            <em>
              ${
                p
                  ? (
                    p.gap >= 0
                      ? 'Reste '
                      : 'Écart '
                  ) + fmt(Math.abs(p.gap))
                  : '—'
              }
            </em>
          </article>

          <article>
            <small>PAIE PROJETÉE</small>

            <strong>
              ${
                pay?.gross != null
                  ? money(pay.gross)
                  : '—'
              }
            </strong>

            <span>
              ${
                pay
                  ? fmt(pay.tte) +
                    ' TTE · ' +
                    fmt(pay.h25 + pay.h50) +
                    ' HS'
                  : 'Données indisponibles'
              }
            </span>

            <em>Net estimé : —</em>
          </article>

        </section>

        <section class="mh302-card">

          <div class="mh302-title">
            <b>À SURVEILLER</b>
            <span>${watch.length}/2</span>
          </div>

          ${
            watch.length
              ? watch.map(a => `
                <button
                  class="mh302-alert ${a.level}"
                  onclick="mhOpenDay('${esc(a.k)}')">

                  <b>${
                    a.level === 'bad'
                      ? '🔴'
                      : a.level === 'warn'
                        ? '🟡'
                        : '🔵'
                  }</b>

                  <span>
                    <strong>${esc(a.title)}</strong>
                    ${esc(a.text)}
                  </span>

                  <i>›</i>
                </button>
              `).join('')
              : `
                <div class="mh302-ok">
                  ✓ Aucun point particulier à surveiller.
                </div>
              `
          }

          <button
            class="mh302-detail"
            onclick="tab('analyse')">
            VOIR LE DÉTAIL
          </button>

        </section>

        <section class="mh302-card">

          <div class="mh302-title">
            <b>MESHEURES INSIGHTS</b>
            <button onclick="tab('analyse')">
              Analyse ›
            </button>
          </div>

          <div class="mh302-insights">

            <div>
              <b>${ins.avgTte ? fmt(ins.avgTte) : '—'}</b>
              <small>TTE moyen</small>
            </div>

            <div>
              <b>${ins.avgAmp ? fmt(ins.avgAmp) : '—'}</b>
              <small>Amplitude</small>
            </div>

            <div>
              <b>${ins.avgPause ? fmt(ins.avgPause) : '—'}</b>
              <small>Pause</small>
            </div>

            <div>
              <b>${ins.avgStart ? hhmm(ins.avgStart) : '—'}</b>
              <small>Début moyen</small>
            </div>

          </div>

          <p class="mh302-insight-line">
            ${
              ins.delta != null
                ? 'Cette semaine : <b>' +
                  fmt(ins.weekAvg) +
                  '</b>/jour, écart de <b>' +
                  (ins.delta >= 0 ? '+' : '') +
                  fmt(ins.delta) +
                  '</b> avec la moyenne mensuelle.'
                : 'Pas assez de données pour établir une comparaison.'
            }
          </p>

        </section>

        <section class="mh302-card">

          <div class="mh302-title">
            <b>CALENDRIER INTELLIGENT</b>
            <button onclick="tab('mois')">
              Planning ›
            </button>
          </div>

          <div class="mh302-calendar">
            ${calendar()}
          </div>

        </section>

        <section class="mh302-actions">

          <button onclick="mh302OpenQuickAdd()">
            ＋ Ajouter une journée
          </button>

          <button onclick="tab('paie')">
            € Détail paie
          </button>

          <button onclick="tab('reg')">
            💾 Sauvegarde
          </button>

        </section>

      </div>
    `;
  }

  // ---------------------------------------------
  // QUICK ADD
  // ---------------------------------------------

  function bindSmartTimes(root) {
    root.querySelectorAll('[data-mh302-time]')
      .forEach(input => {

        if (input.dataset.bound) return;

        input.dataset.bound = '1';

        input.addEventListener('blur', () => {
          input.value = smartTime(input.value);
        });

        input.addEventListener('change', () => {
          input.value = smartTime(input.value);
        });
      });
  }

  window.mh302OpenQuickAdd = function () {

    let modal = $('mh302QuickAdd');

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'mh302QuickAdd';
      modal.className = 'mh302-modal';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="mh302-sheet">

        <div class="mh302-sheet-head">
          <div>
            <small>MESHEURES</small>
            <b>Nouvelle journée</b>
          </div>

          <button onclick="mh302CloseQuickAdd()">×</button>
        </div>

        <label>
          Date
          <input
            id="mh302Date"
            type="date"
            value="${today()}">
        </label>

        <div class="mh302-form-grid">

          <label>
            Début
            <input
              id="mh302Deb"
              data-mh302-time
              inputmode="numeric"
              placeholder="07:50">
          </label>

          <label>
            Fin
            <input
              id="mh302Fin"
              data-mh302-time
              inputmode="numeric"
              placeholder="17:30">
          </label>

        </div>

        <label>
          Pause en minutes
          <input
            id="mh302Pause"
            type="number"
            inputmode="numeric"
            min="0"
            value="20">
        </label>

        <button
          class="mh302-save"
          onclick="mh302SaveQuickAdd()">
          Enregistrer
        </button>

      </div>
    `;

    modal.classList.add('on');
    bindSmartTimes(modal);
  };

  window.mh302CloseQuickAdd = function () {
    $('mh302QuickAdd')?.classList.remove('on');
  };

  window.mh302SaveQuickAdd = function () {

    const k = $('mh302Date')?.value;
    const deb = smartTime($('mh302Deb')?.value);
    const fin = smartTime($('mh302Fin')?.value);
    const pause = Math.max(
      0,
      Number($('mh302Pause')?.value) || 0
    );

    if (!k || !deb || !fin) {
      alert('Date, début et fin sont obligatoires.');
      return;
    }

    if (
      timeToMinutes(deb) == null ||
      timeToMinutes(fin) == null
    ) {
      alert('Format horaire incorrect.');
      return;
    }

    DB.days = DB.days || {};

    const old = DB.days[k] || {};

    DB.days[k] = {
      ...old,
      t: 'T',
      deb,
      fin,
      p: Array.isArray(old.p) ? old.p : []
    };

    /*
     * Important :
     * On ne fabrique pas une structure de pause inconnue.
     * La journée est créée proprement puis le moteur existant
     * reste responsable de son calcul.
     *
     * Si aucune pause n'est renseignée, aucune pause fictive
     * n'est créée.
     */

    if (pause === 0)
      DB.days[k].p = [];

    if (typeof save === 'function')
      save();

    window.mh302CloseQuickAdd();

    if (typeof mhRefresh === 'function')
      mhRefresh('smart-quick-add');

    setTimeout(renderHome, 80);
  };

  // ---------------------------------------------
  // FAB GLOBAL
  // ---------------------------------------------

  function ensureFab() {

    if ($('mh302Fab')) return;

    const b = document.createElement('button');

    b.id = 'mh302Fab';
    b.className = 'mh302-fab';
    b.textContent = '+';
    b.setAttribute(
      'aria-label',
      'Ajouter une journée'
    );

    b.onclick = window.mh302OpenQuickAdd;

    document.body.appendChild(b);
  }

  // ---------------------------------------------
  // SWIPE
  // ---------------------------------------------

  function ensureSwipe() {

    if (document.body.dataset.mh302Swipe)
      return;

    document.body.dataset.mh302Swipe = '1';

    let sx = 0;
    let sy = 0;

    document.addEventListener(
      'touchstart',
      e => {
        const t = e.changedTouches[0];
        sx = t.clientX;
        sy = t.clientY;
      },
      { passive: true }
    );

    document.addEventListener(
      'touchend',
      e => {

        const t = e.changedTouches[0];

        const dx = t.clientX - sx;
        const dy = t.clientY - sy;

        if (
          Math.abs(dx) < 80 ||
          Math.abs(dx) < Math.abs(dy) * 1.35
        )
          return;

        const current =
          window.curTab || 'home';

        const i = PRIMARY.indexOf(current);

        if (i < 0) return;

        const next =
          dx < 0
            ? PRIMARY[Math.min(PRIMARY.length - 1, i + 1)]
            : PRIMARY[Math.max(0, i - 1)];

        if (
          next &&
          next !== current &&
          typeof tab === 'function'
        )
          tab(next);
      },
      { passive: true }
    );
  }

  // ---------------------------------------------
  // BOOT
  // ---------------------------------------------

  function boot() {

    document.documentElement.dataset.mhVersion = V;

    ensureFab();
    ensureSwipe();

    setTimeout(() => {
      try {
        if ((window.curTab || 'home') === 'home')
          renderHome();
      } catch (e) {
        console.warn(
          'MesHeures SMART CONTROL:',
          e
        );
      }
    }, 100);
  }

  window.MH302 = {
    version: V,
    renderHome,
    insights,
    anomalies,
    payroll,
    period
  };

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once: true }
    );
  } else {
    boot();
  }

})();
JS

echo "✓ Smart Control créé"

# ------------------------------------------------
# 5. INDEX + SW
# ------------------------------------------------

echo
echo "▶ 5/9 — Branchement du module"

python3 - <<'PY'
from pathlib import Path

index = Path("app/src/main/assets/web/index.html")
s = index.read_text(encoding="utf-8")

if "scripts/app-v30-smart.js" not in s:
    needle = '<script defer src="scripts/app-v30.js"></script>'

    if needle not in s:
        raise SystemExit(
            "app-v30.js introuvable dans index.html"
        )

    s = s.replace(
        needle,
        needle +
        '\n<script defer src="scripts/app-v30-smart.js"></script>'
    )

s = s.replace(
    'content="30.1.0"',
    'content="30.2.0"'
)

index.write_text(s, encoding="utf-8")

sw = Path("app/src/main/assets/web/sw.js")
s = sw.read_text(encoding="utf-8")

if "scripts/app-v30-smart.js" not in s:
    if "'./scripts/app-v30.js'" in s:
        s = s.replace(
            "'./scripts/app-v30.js'",
            "'./scripts/app-v30.js','./scripts/app-v30-smart.js'"
        )
    elif '"./scripts/app-v30.js"' in s:
        s = s.replace(
            '"./scripts/app-v30.js"',
            '"./scripts/app-v30.js","./scripts/app-v30-smart.js"'
        )
    else:
        raise SystemExit(
            "app-v30.js introuvable dans sw.js"
        )

s = s.replace("v30.1.0", "v30.2.0")

sw.write_text(s, encoding="utf-8")

print("✓ index.html + sw.js")
PY

# ------------------------------------------------
# 6. CSS
# ------------------------------------------------

echo
echo "▶ 6/9 — Interface Smart Control"

cat >> app/src/main/assets/web/style/v30.css <<'CSS'

/* =====================================================
   V30.2 SMART CONTROL
   ===================================================== */

.mh302-shell{
  max-width:760px;
  margin:0 auto;
  padding:4px 0 110px;
}

.mh302-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:8px 3px 15px;
}

.mh302-head span{
  font-size:9px;
  letter-spacing:1.2px;
  font-weight:900;
}

.mh302-head h1{
  margin:4px 0;
  font-size:26px;
}

.mh302-head small{
  font-size:10px;
  opacity:.65;
}

.mh302-settings{
  width:43px!important;
  height:43px!important;
  min-height:43px!important;
  padding:0!important;
  border-radius:14px!important;
}

.mh302-hero{
  padding:17px;
  margin-bottom:9px;
  border-radius:22px;
  border:1px solid #285c40;
  background:linear-gradient(145deg,#10251a,#0d1519);
}

.mh302-hero-top{
  display:flex;
  justify-content:space-between;
}

.mh302-hero-top small{
  display:block;
  font-size:8px;
  opacity:.65;
}

.mh302-hero-top b{
  display:block;
  margin-top:3px;
  font-size:13px;
}

.mh302-hero>strong{
  display:block;
  margin:16px 0 10px;
  font-size:49px;
  line-height:1;
  letter-spacing:-2px;
}

.mh302-inline{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:6px;
}

.mh302-inline span{
  font-size:8px;
  opacity:.65;
}

.mh302-inline b{
  display:block;
  margin-top:3px;
  font-size:11px;
  opacity:1;
}

.mh302-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
  margin-bottom:9px;
}

.mh302-grid article{
  padding:14px;
  border:1px solid var(--mh30-line);
  border-radius:18px;
  background:linear-gradient(145deg,#151e27,#0f161d);
}

.mh302-grid article small{
  font-size:8px;
  opacity:.65;
}

.mh302-grid article>strong{
  display:block;
  margin-top:7px;
  font-size:25px;
}

.mh302-grid article>span,
.mh302-grid article>em{
  display:block;
  margin-top:3px;
  font-size:9px;
  opacity:.65;
  font-style:normal;
}

.mh302-progress{
  height:7px;
  margin:9px 0 5px;
  border-radius:99px;
  overflow:hidden;
  background:#202a34;
}

.mh302-progress i{
  display:block;
  height:100%;
  border-radius:99px;
  background:#52d889;
}

.mh302-card{
  padding:14px;
  margin-bottom:9px;
  border:1px solid var(--mh30-line);
  border-radius:18px;
  background:linear-gradient(145deg,#151e27,#0f161d);
}

.mh302-title{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:10px;
}

.mh302-title>b{
  font-size:10px;
  letter-spacing:.6px;
}

.mh302-title span,
.mh302-title button{
  font-size:9px;
  opacity:.65;
  background:transparent!important;
  border:0!important;
  min-height:0!important;
  padding:2px!important;
  box-shadow:none!important;
}

.mh302-alert{
  width:100%;
  display:grid;
  grid-template-columns:24px 1fr 18px;
  align-items:center;
  gap:7px;
  margin-bottom:6px;
  padding:10px!important;
  min-height:0!important;
  text-align:left;
  border-radius:12px!important;
  background:#111a22!important;
  border:1px solid #27323d!important;
  box-shadow:none!important;
}

.mh302-alert span{
  display:flex;
  flex-direction:column;
  font-size:9px;
}

.mh302-alert span strong{
  margin-bottom:2px;
  font-size:10px;
}

.mh302-alert i{
  font-style:normal;
  font-size:18px;
  opacity:.6;
}

.mh302-alert.bad{
  border-left:3px solid #d85b63!important;
}

.mh302-alert.warn{
  border-left:3px solid #d7ad52!important;
}

.mh302-alert.info{
  border-left:3px solid #5999d9!important;
}

.mh302-ok{
  padding:11px;
  border-radius:11px;
  background:#102318;
  font-size:10px;
}

.mh302-detail{
  width:100%;
  margin-top:8px;
  min-height:40px!important;
  font-size:10px!important;
}

.mh302-insights{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:6px;
}

.mh302-insights>div{
  padding:10px 7px;
  border-radius:11px;
  background:#0c131a;
  border:1px solid #25303a;
}

.mh302-insights b{
  display:block;
  font-size:15px;
}

.mh302-insights small{
  display:block;
  margin-top:2px;
  font-size:7px;
  opacity:.65;
}

.mh302-insight-line{
  margin:9px 0 0;
  font-size:9px;
  line-height:1.45;
  opacity:.7;
}

.mh302-calendar{
  display:grid;
  grid-template-columns:repeat(7,1fr);
  gap:5px;
}

.mh302-cal-day{
  min-height:68px!important;
  padding:7px 2px!important;
  border-radius:11px!important;
  background:#0d141b!important;
  border:1px solid #27323d!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:space-between!important;
  box-shadow:none!important;
}

.mh302-cal-day b{
  font-size:11px;
}

.mh302-cal-day strong{
  font-size:14px;
}

.mh302-cal-day small{
  max-width:100%;
  overflow:hidden;
  white-space:nowrap;
  font-size:7px;
  opacity:.65;
}

.mh302-cal-day.ok{
  border-color:#27603f!important;
}

.mh302-cal-day.warn{
  border-color:#604b1e!important;
}

.mh302-cal-day.bad{
  border-color:#63272b!important;
}

.mh302-cal-day.rest{
  border-color:#31415c!important;
}

.mh302-cal-day.empty{
  opacity:.6;
}

.mh302-actions{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:6px;
}

.mh302-actions button{
  min-height:48px!important;
  font-size:9px!important;
}

.mh302-fab{
  position:fixed!important;
  right:17px!important;
  bottom:calc(94px + env(safe-area-inset-bottom))!important;
  z-index:100!important;
  width:58px!important;
  height:58px!important;
  min-height:58px!important;
  padding:0!important;
  border-radius:50%!important;
  font-size:30px!important;
  font-weight:300!important;
  box-shadow:0 10px 28px #0008!important;
}

.mh302-modal{
  position:fixed;
  inset:0;
  z-index:1000;
  display:none;
  background:#0009;
  backdrop-filter:blur(7px);
}

.mh302-modal.on{
  display:flex;
  align-items:flex-end;
}

.mh302-sheet{
  width:100%;
  max-width:760px;
  margin:0 auto;
  padding:17px 15px calc(20px + env(safe-area-inset-bottom));
  border-radius:23px 23px 0 0;
  background:#111920;
  border:1px solid #2c3944;
}

.mh302-sheet-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:12px;
}

.mh302-sheet-head small,
.mh302-sheet-head b{
  display:block;
}

.mh302-sheet-head small{
  font-size:8px;
  letter-spacing:1px;
}

.mh302-sheet-head b{
  margin-top:3px;
  font-size:18px;
}

.mh302-sheet-head button{
  width:40px!important;
  min-height:40px!important;
  padding:0!important;
  border-radius:50%!important;
}

.mh302-sheet label{
  display:block;
  margin:8px 0;
  font-size:9px;
  opacity:.7;
}

.mh302-sheet input{
  width:100%;
  margin-top:4px;
  font-size:16px;
}

.mh302-form-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
}

.mh302-save{
  width:100%;
  margin-top:8px;
  min-height:48px!important;
}

@media(max-width:600px){

  .mh302-grid{
    grid-template-columns:1fr;
  }

  .mh302-inline{
    grid-template-columns:repeat(2,1fr);
  }

  .mh302-insights{
    grid-template-columns:repeat(2,1fr);
  }

  .mh302-actions{
    grid-template-columns:1fr;
  }

  .mh302-cal-day{
    min-height:62px!important;
  }
}

CSS

# ------------------------------------------------
# 7. AUDIT
# ------------------------------------------------

echo
echo "▶ 7/9 — Audit Smart Control"

cat > qa/v30-2-smart-control.py <<'PY'
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "app/src/main/assets/web"
JS = WEB / "scripts"

def ok(name, value):
    print(("PASS" if value else "FAIL") + ": " + name)
    return value

version = (ROOT / "VERSION").read_text().strip()
props = (ROOT / "version.properties").read_text()
index = (WEB / "index.html").read_text()
sw = (WEB / "sw.js").read_text()
runtime = (JS / "app-v30.js").read_text()
smart = (JS / "app-v30-smart.js").read_text()
css = (WEB / "style/v30.css").read_text()

checks = []

checks += [ok("VERSION 30.2.0", version == "30.2.0")]
checks += [ok("VERSION_CODE 3020", "VERSION_CODE=3020" in props)]
checks += [ok("Smart JS chargé", "scripts/app-v30-smart.js" in index)]
checks += [ok("Smart JS dans Service Worker", "app-v30-smart.js" in sw)]
checks += [ok("runtime canonique V30.2", "const V='30.2.0'" in runtime)]
checks += [ok("SMART CONTROL", "SMART CONTROL" in smart)]
checks += [ok("cockpit", "renderHome" in smart)]
checks += [ok("Quick Add", "mh302OpenQuickAdd" in smart and "mh302SaveQuickAdd" in smart)]
checks += [ok("Smart time", "smartTime" in smart)]
checks += [ok("Insights", "function insights" in smart)]
checks += [ok("Anomalies", "function anomalies" in smart)]
checks += [ok("Paie moteur existant", "calcPer" in smart and "brutOf" in smart)]
checks += [ok("Calendrier", "dayStatus" in smart)]
checks += [ok("FAB global", "mh302Fab" in smart)]
checks += [ok("Swipe", "touchstart" in smart and "touchend" in smart)]
checks += [ok("CSS Smart Control", ".mh302-shell" in css and ".mh302-fab" in css)]
checks += [ok("Pas de runtime V24", "app-v24.js" not in index + sw)]
checks += [ok("Pas de runtime V25", "app-v25.js" not in index + sw)]
checks += [ok("Pas de runtime V26", "app-v26.js" not in index + sw)]
checks += [ok("Pas de runtime V27", "app-v27.js" not in index + sw)]
checks += [ok("Pas de runtime V28", "app-v28.js" not in index + sw)]

if not all(checks):
    print("\nSMART CONTROL AUDIT: FAIL")
    sys.exit(1)

print("\nSMART CONTROL AUDIT: PASS")
PY

python3 qa/v30-2-smart-control.py

# ------------------------------------------------
# 8. AUDITS EXISTANTS + SYNTAXE
# ------------------------------------------------

echo
echo "▶ 8/9 — Audits de régression"

python3 qa/release-audit.py
python3 qa/performance-audit.py

if command -v node >/dev/null 2>&1; then
  node --check app/src/main/assets/web/scripts/app-v30.js
  node --check app/src/main/assets/web/scripts/app-v30-smart.js
  echo "✓ JavaScript syntax PASS"
else
  echo "⚠ Node absent : syntax JS sera contrôlée par CI"
fi

git diff --check

# ------------------------------------------------
# 9. COMMIT + PUSH
# ------------------------------------------------

echo
echo "▶ 9/9 — Préparation du commit"

git status --short
echo

git add \
  VERSION \
  version.properties \
  app/src/main/assets/web/index.html \
  app/src/main/assets/web/sw.js \
  app/src/main/assets/web/style/v30.css \
  app/src/main/assets/web/scripts/app-v30.js \
  app/src/main/assets/web/scripts/app-v30-smart.js \
  qa/v30-2-smart-control.py

git diff --cached --check

echo
echo "Résumé :"
git diff --cached --stat

echo
echo "Version :"
cat VERSION
cat version.properties

echo
echo "Commit V30.2.0..."

git commit -m "V30.2.0: Smart Control cockpit and intelligence"

git push origin v30.0.2-clean

echo
echo "=============================================="
echo " ✅ V30.2.0 PUSHÉ"
echo "=============================================="

git log -1 --oneline

echo
echo "⚠️ NE PAS INSTALLER D'APK."
echo "Attente du build GitHub Actions + vérification artefact."
