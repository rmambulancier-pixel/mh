/**
 * Pont de compatibilité v24 / LiveEngine
 */
(function() {
  console.log("Compatibilité v24 active.");
  if (typeof LiveEngine !== 'undefined') {
    window.AppV24 = LiveEngine;
  }
})();
