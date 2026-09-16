/**
 * MesHeures - Moteur Live Unifié & Réactif (v24 Clean)
 */
(function() {
  'use strict';

  const LiveEngine = {
    state: {
      startTime: null,
      endTime: null,
      pauses: [],
      coefficient: 0.90,
      serviceActive: false,
      timer: null
    },

    init() {
      // Masquer le second compteur redondant immédiatement
      this.purgeDuplicateUI();
      this.bindEvents();
      this.restoreState();
    },

    purgeDuplicateUI() {
      // Supprime ou masque le compteur en doublon
      const counters = document.querySelectorAll('.counter-display, .status-card, [id*="counter"], [id*="timer"]');
      if (counters.length > 1) {
        for (let i = 1; i < counters.length; i++) {
          if (counters[i].id !== 'live-timer-unified') {
            counters[i].style.display = 'none';
          }
        }
      }
    },

    toMinutes(str) {
      if (!str || !str.includes(':')) return null;
      const [h, m] = str.split(':').map(Number);
      return isNaN(h) || isNaN(m) ? null : h * 60 + m;
    },

    formatTime(mins) {
      const m = Math.max(0, Math.floor(mins));
      const h = Math.floor(m / 60);
      const rem = m % 60;
      return `${h}h${rem.toString().padStart(2, '0')}`;
    },

    calculatePauses(currentLimit) {
      let total = 0;
      for (const p of this.state.pauses) {
        const s = this.toMinutes(p.start);
        const e = this.toMinutes(p.end);
        if (s !== null && e !== null && e > s) {
          const limit = currentLimit ? Math.min(e, currentLimit) : e;
          if (limit > s) total += (limit - s);
        }
      }
      return total;
    },

    recalculate() {
      const startMin = this.toMinutes(this.state.startTime);
      if (startMin === null) return;

      let endMin;
      if (this.state.serviceActive) {
        const now = new Date();
        endMin = now.getHours() * 60 + now.getMinutes();
      } else {
        endMin = this.toMinutes(this.state.endTime);
      }

      if (endMin === null || endMin < startMin) return;

      const amplitude = endMin - startMin;
      const pauses = this.calculatePauses(endMin);
      const worked = Math.max(0, amplitude - pauses);
      const tte = Math.round(worked * this.state.coefficient);

      this.render({ amplitude, pauses, worked, tte });
    },

    render(metrics) {
      const timerVal = document.getElementById('live-timer-val');
      const ampVal = document.getElementById('live-amp-val');
      const tteVal = document.getElementById('live-tte-val');
      const pauseVal = document.getElementById('live-pause-val');

      if (timerVal) timerVal.textContent = this.formatTime(metrics.amplitude);
      if (ampVal) ampVal.textContent = this.formatTime(metrics.amplitude);
      if (tteVal) tteVal.textContent = this.formatTime(metrics.tte);
      if (pauseVal) pauseVal.textContent = this.formatTime(metrics.pauses);
    },

    bindEvents() {
      const startInp = document.getElementById('input-start-time');
      const endInp = document.getElementById('input-end-time');
      const btn = document.getElementById('btn-toggle-service');

      if (startInp) {
        startInp.addEventListener('change', (e) => {
          this.state.startTime = e.target.value;
          this.recalculate();
        });
      }

      if (endInp) {
        endInp.addEventListener('change', (e) => {
          this.state.endTime = e.target.value;
          this.recalculate();
        });
      }

      if (btn) {
        btn.addEventListener('click', () => {
          const now = new Date();
          const str = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          if (!this.state.serviceActive) {
            this.state.serviceActive = true;
            if (startInp && !startInp.value) {
              startInp.value = str;
              this.state.startTime = str;
            }
            btn.textContent = 'Arrêter';
            btn.classList.add('btn-danger');
            this.state.timer = setInterval(() => this.recalculate(), 1000);
          } else {
            this.state.serviceActive = false;
            if (endInp) {
              endInp.value = str;
              this.state.endTime = str;
            }
            btn.textContent = 'Démarrer';
            btn.classList.remove('btn-danger');
            clearInterval(this.state.timer);
          }
          this.recalculate();
        });
      }
    },

    restoreState() {
      const startInp = document.getElementById('input-start-time');
      if (startInp && startInp.value) {
        this.state.startTime = startInp.value;
        this.recalculate();
      }
    }
  };

  window.LiveEngine = LiveEngine;
  document.addEventListener('DOMContentLoaded', () => LiveEngine.init());
})();
