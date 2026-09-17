/* MesHeures V25 — compatibility bridge.
 * The old standalone live engine duplicated the calculation core and used a
 * hard-coded 0.90 coefficient. V25 now stores the running session in DB.days
 * and delegates all derived values to cd(), the canonical calculation engine.
 */
window.LiveEngine={
  startLiveService:function(){return window.MH25Live?.start?.()},
  stopLiveService:function(){return window.MH25Live?.stop?.()},
  updateUI:function(){return window.MH25Live?.render?.()},
  toggle:function(){return window.MH25Live?.toggle?.()}
};
