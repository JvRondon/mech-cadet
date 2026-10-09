/* ============================================
   MECH//CADET — Armazenamento Local
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});

  var KEY_PROFILE  = 'mech-cadet.profile';
  var KEY_SETTINGS = 'mech-cadet.settings';
  var KEY_SCORES   = 'mech-cadet.scores';

  function read(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return (parsed === null || parsed === undefined) ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // Modo privado / storage desabilitado — o jogo continua funcionando.
      return false;
    }
  }

  MC.storage = {
    saveProfile: function (profile) { return write(KEY_PROFILE, profile); },
    loadProfile: function () { return read(KEY_PROFILE, null); },

    saveSettings: function (s) { return write(KEY_SETTINGS, s); },
    loadSettings: function () { return read(KEY_SETTINGS, null); },

    saveScore: function (entry) {
      var list = read(KEY_SCORES, []);
      list.push(entry);
      list.sort(function (a, b) { return b.score - a.score; });
      return write(KEY_SCORES, list.slice(0, 10));
    },
    loadScores: function () { return read(KEY_SCORES, []); },

    generateName: function () {
      return 'CADETE-' + MC.utils.randomInt(1000, 9999);
    },

    rankForScore: function (score) {
      var ranks = MC.CONFIG.ranks;
      for (var i = ranks.length - 1; i >= 0; i--) {
        if (score >= ranks[i].min) return ranks[i];
      }
      return ranks[0];
    },
  };

})(window);