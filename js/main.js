/* ============================================
   MECH//CADET — Ponto de entrada
   ============================================ */
(function (global) {
  'use strict';

  var MC = global.MC;

  function fatal(message, err) {
    console.error('[MECH//CADET]', message, err);

    var box = document.getElementById('fatal');
    if (!box) return;

    box.classList.remove('hidden');
    var text = document.getElementById('fatal-message');
    if (text) text.textContent = message + (err ? ': ' + err.message : '');

    // Esconde as telas para não confundir
    var screens = ['menu', 'boot', 'briefing', 'victory', 'defeat', 'pause'];
    for (var i = 0; i < screens.length; i++) {
      var s = document.getElementById(screens[i]);
      if (s) s.classList.add('hidden');
    }
  }

  function boot() {
    if (!MC || !MC.game) {
      fatal('Scripts não carregaram. Verifique se os arquivos .js estão na pasta /js.');
      return;
    }

    try {
      MC.game.start();
    } catch (e) {
      fatal('Falha ao iniciar o jogo', e);
    }
  }

  // Erros globais não devem "matar" a página silenciosamente
  global.addEventListener('error', function (e) {
    console.error('[MECH//CADET] Erro não tratado:', e.error || e.message);
  });
  global.addEventListener('unhandledrejection', function (e) {
    console.error('[MECH//CADET] Promessa rejeitada:', e.reason);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window);