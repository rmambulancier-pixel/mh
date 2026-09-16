const LiveEngine = {
  state: {
    startTime: null,
    endTime: null,
    pauses: [],
    coefficient: 0.90,
    serviceActive: false,
    timerInterval: null
  },

  init() {
    this.bindInputs();
    this.restoreDayState();
  },

  toMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
  },

  toTimeString(totalMinutes) {
    const m = Math.max(0, Math.floor(totalMinutes));
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  },

  calculatePausesTotal(currentLimitMin) {
    let total = 0;
    for (const p of this.state.pauses) {
      const pStart = this.toMinutes(p.start);
      const pEnd = this.toMinutes(p.end);
      if (pStart !== null && pEnd !== null && pEnd > pStart) {
        const effectiveEnd = currentLimitMin ? Math.min(pEnd, currentLimitMin) : pEnd;
        if (effectiveEnd > pStart) total += (effectiveEnd - pStart);
      }
    }
    return total;
  },

  computeCurrentMetrics() {
    const startMin = this.toMinutes(this.state.startTime);
    if (startMin === null) return null;

    let endMin;
    if (this.state.serviceActive) {
      const now = new Date();
      endMin = now.getHours() * 60 + now.getMinutes();
    } else {
      endMin = this.toMinutes(this.state.endTime);
    }

    if (endMin === null || endMin < startMin) return null;

    const rawAmplitude = endMin - startMin;
    const totalPauses = this.calculatePausesTotal(endMin);
    const workedMinutes = Math.max(0, rawAmplitude - totalPauses);
    const tteMinutes = Math.round(workedMinutes * this.state.coefficient);

    return { rawAmplitude, totalPauses, workedMinutes, tteMinutes };
  },

  updateUI() {
    const metrics = this.computeCurrentMetrics();
    const liveContainer = document.getElementById('unified-live-card');
    const liveTimeDisplay = document.getElementById('live-timer-val');
    const tteDisplay = document.getElementById('live-tte-val');
    const ampDisplay = document.getElementById('live-amp-val');
    const pauseDisplay = document.getElementById('live-pause-val');

    if (!metrics) {
      if (liveContainer) liveContainer.classList.add('hidden');
      return;
    }

    if (liveContainer) liveContainer.classList.remove('hidden');
    if (liveTimeDisplay) liveTimeDisplay.textContent = this.toTimeString(metrics.rawAmplitude);
    if (ampDisplay) ampDisplay.textContent = this.toTimeString(metrics.rawAmplitude);
    if (tteDisplay) tteDisplay.textContent = this.toTimeString(metrics.tteMinutes);
    if (pauseDisplay) pauseDisplay.textContent = this.toTimeString(metrics.totalPauses);
  },

  startLiveService(startTimeStr) {
    this.state.startTime = startTimeStr;
    this.state.serviceActive = true;
    this.updateUI();
    if (this.state.timerInterval) clearInterval(this.state.timerInterval);
    this.state.timerInterval = setInterval(() => this.updateUI(), 1000);
  },

  stopLiveService(endTimeStr) {
    this.state.serviceActive = false;
    this.state.endTime = endTimeStr;
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
    this.updateUI();
  },

  bindInputs() {
    const startInput = document.getElementById('input-start-time');
    const endInput = document.getElementById('input-end-time');
    const toggleBtn = document.getElementById('btn-toggle-service');

    if (startInput) {
      startInput.addEventListener('change', (e) => {
        this.state.startTime = e.target.value;
        this.updateUI();
      });
    }

    if (endInput) {
      endInput.addEventListener('change', (e) => {
        this.state.endTime = e.target.value;
        this.updateUI();
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (!this.state.serviceActive) {
          const now = new Date();
          const str = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          if (startInput && !startInput.value) startInput.value = str;
          this.startLiveService(startInput ? startInput.value : str);
          toggleBtn.textContent = 'Arrêter le service';
        } else {
          const now = new Date();
          const str = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          if (endInput) endInput.value = str;
          this.stopLiveService(str);
          toggleBtn.textContent = 'Démarrer le service';
        }
      });
    }
  },

  restoreDayState() {
    const startInput = document.getElementById('input-start-time');
    if (startInput && startInput.value) {
      this.state.startTime = startInput.value;
      this.updateUI();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => LiveEngine.init());
