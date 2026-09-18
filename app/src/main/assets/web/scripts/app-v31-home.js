/*
 * MesHeures V31.0.0 — ACCUEIL PREMIUM
 *
 * Nouveau renderer indépendant.
 * Le moteur V30 reste la source de vérité.
 * Smart Control n'est pas utilisé pour rendre l'Accueil.
 */

(function () {
  'use strict';

  const V = '31.0.0';

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
    return DB?.days?.[k] || {
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
      const anchor = DB?.s?.anchor || k;

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
          Number(DB?.s?.base || 0) * 120;

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
            Number(DB?.s?.base || 0) * 120,
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

    const keys = Object.keys(DB?.days || {})
      .filter(x =>
        x > k &&
        ['T', 'NUIT'].includes(DB.days[x]?.t)
      )
      .sort();

    return keys.length
      ? {
          k: keys[0],
          d: DB.days[keys[0]]
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

  function renderHome() {
    const host = $('s-home');

    if (!host)
      return;

    const k = todayKey();
    const d = dayData(k);
    const r = dayCalc(k);
    const p = periodInfo();
    const m = monthInfo();
    const next = nextService();
    const recent = recentDays();

    const worked =
      ['T', 'NUIT'].includes(d.t);

    const progress =
      p && Number(p.objective) > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Number(p.actual || 0) /
              Number(p.objective) *
              100
            )
          )
        : 0;

    const monthTte =
      Number(m?.tte || 0);

    const monthDays =
      Number(m?.trav || 0);

    const monthAmp =
      monthDays > 0
        ? Number(m?.amp || 0) / monthDays
        : 0;

    const recentWork =
      recent.filter(x =>
        ['T', 'NUIT'].includes(x.d?.t)
      );

    const maxTte =
      Math.max(
        1,
        ...recentWork.map(x =>
          Number(x.r?.tte || 0)
        )
      );

    host.innerHTML = `
      <div class="mh31-home">

        <header class="mh31-head">

          <div class="mh31-brand">

            <div class="mh31-logo">
              ⏱
            </div>

            <div>
              <span>MESHEURES</span>
              <strong>V31</strong>
              <h1>Tableau de bord</h1>
              <small>
                ${esc(dateLabel(k))}
                · ${esc(dayLabel(k))}
              </small>
            </div>

          </div>

          <button
            class="mh31-settings"
            onclick="tab('reg')"
            aria-label="Réglages">
            ⚙
          </button>

        </header>

        <section class="mh31-hero">

          <div class="mh31-hero-top">

            <div>
              <span>AUJOURD’HUI</span>
              <b data-v31-state>
                ${esc(serviceType(d))}
              </b>
            </div>

            <button
              class="mh31-live-button"
              data-v31-live-button
              onclick="mhV31ToggleLive()">
              ${
                window.MH30Live?.active?.()
                  ? '■ Arrêter'
                  : '▶ Démarrer'
              }
            </button>

          </div>

          <div
            class="mh31-clock"
            data-v31-clock>
            ${fmt(r.tte)}
          </div>

          <div class="mh31-caption">
            Temps de travail effectif
          </div>

          <div class="mh31-meta">

            <div>
              <span>Début</span>
              <b data-v31-start>
                ${esc(d.deb || '—')}
              </b>
            </div>

            <div>
              <span>Fin</span>
              <b data-v31-end>
                ${esc(
                  window.MH30Live?.active?.()
                    ? 'En cours'
                    : d.fin || '—'
                )}
              </b>
            </div>

            <div>
              <span>Pause</span>
              <b data-v31-pause>
                ${fmt(r.pz)}
              </b>
            </div>

            <div>
              <span>Amplitude</span>
              <b data-v31-amp>
                ${fmt(r.amp)}
              </b>
            </div>

          </div>

        </section>

        <section class="mh31-actions">

          <button onclick="tab('jour')">
            <b>＋</b>
            <span>Saisie</span>
            <small>Journée & pauses</small>
          </button>

          <button onclick="tab('mois')">
            <b>▦</b>
            <span>Planning</span>
            <small>Calendrier</small>
          </button>

          <button onclick="tab('paie')">
            <b>€</b>
            <span>Paie</span>
            <small>Heures & HS</small>
          </button>

          <button onclick="tab('analyse')">
            <b>◌</b>
            <span>Analyse</span>
            <small>Suivi</small>
          </button>

        </section>

        <section class="mh31-section">

          <div class="mh31-title">
            <div>
              <span>QUATORZAINE</span>
              <b>
                ${
                  p
                    ? fmt(p.actual)
                    : '—'
                }
              </b>
            </div>

            <button onclick="tab('paie')">
              Détail ›
            </button>
          </div>

          <div class="mh31-progress">
            <i style="width:${progress.toFixed(1)}%"></i>
          </div>

          <div class="mh31-period">

            <span>
              ${
                p
                  ? fmt(p.objective) +
                    ' objectif'
                  : 'Objectif indisponible'
              }
            </span>

            <span>
              ${
                p
                  ? (
                      Number(p.actual) >=
                      Number(p.objective)
                        ? 'Seuil atteint'
                        : 'Reste ' +
                          fmt(
                            Number(p.objective) -
                            Number(p.actual)
                          )
                    )
                  : '—'
              }
            </span>

          </div>

        </section>

        <section class="mh31-kpis">

          <div>
            <span>TTE DU MOIS</span>
            <b>${fmt(monthTte)}</b>
          </div>

          <div>
            <span>JOURS TRAVAILLÉS</span>
            <b>${monthDays || '—'}</b>
          </div>

          <div>
            <span>AMPLITUDE MOY.</span>
            <b>
              ${
                monthAmp > 0
                  ? fmt(monthAmp)
                  : '—'
              }
            </b>
          </div>

        </section>

        <section class="mh31-section">

          <div class="mh31-title">
            <div>
              <span>ACTIVITÉ RÉCENTE</span>
              <b>7 jours</b>
            </div>
          </div>

          <div class="mh31-chart">

            ${
              recent.map(x => {

                const minutes =
                  Number(x.r?.tte || 0);

                const height =
                  minutes > 0
                    ? Math.max(
                        8,
                        Math.round(
                          minutes /
                          maxTte *
                          100
                        )
                      )
                    : 4;

                const cls =
                  x.d?.t === 'NUIT'
                    ? 'night'
                    : x.d?.t === 'T'
                      ? 'work'
                      : '';

                return `
                  <button
                    class="mh31-day ${cls}"
                    onclick="mhOpenDay('${esc(x.k)}')">

                    <i style="height:${height}%"></i>

                    <strong>
                      ${new Date(
                        x.k +
                        'T12:00:00'
                      ).getDate()}
                    </strong>

                    <small>
                      ${
                        minutes > 0
                          ? fmt(minutes)
                          : x.d?.t === 'CP'
                            ? 'CP'
                            : x.d?.t === 'RC'
                              ? 'RC'
                              : '—'
                      }
                    </small>

                  </button>
                `;
              }).join('')
            }

          </div>

        </section>

        <section class="mh31-section">

          <div class="mh31-title">

            <div>
              <span>PROCHAINE JOURNÉE</span>
            </div>

            <button onclick="tab('mois')">
              Planning ›
            </button>

          </div>

          ${
            next
              ? `
                <button
                  class="mh31-next"
                  onclick="mhOpenDay('${esc(next.k)}')">

                  <div class="mh31-next-date">
                    <strong>
                      ${new Date(
                        next.k +
                        'T12:00:00'
                      ).getDate()}
                    </strong>
                    <span>
                      ${esc(dayLabel(next.k))}
                    </span>
                  </div>

                  <div>
                    <b>
                      ${esc(dateLabel(next.k))}
                    </b>
                    <small>
                      ${
                        esc(
                          next.d?.deb ||
                          'Horaire à définir'
                        )
                      }
                      ${
                        next.d?.fin
                          ? ' → ' +
                            esc(next.d.fin)
                          : ''
                      }
                    </small>
                  </div>

                  <em>›</em>

                </button>
              `
              : `
                <div class="mh31-empty">
                  Aucune journée future planifiée.
                </div>
              `
          }

        </section>

        <section class="mh31-footer-actions">

          <button onclick="tab('jour')">
            ＋ Ajouter une journée
          </button>

          <button onclick="tab('reg')">
            ⚙ Réglages
          </button>

        </section>

      </div>
    `;

    renderLive();

    if (window.MH30Live?.render)
      window.MH30Live.render();
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
      version.textContent = 'V31.0.0';

    document.title =
      'MesHeures V31.0.0';

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
