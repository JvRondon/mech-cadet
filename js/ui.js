/* ============================================
   MECH//CADET — Interface (HUD e telas)
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var U = MC.utils;
  var C = MC.CONFIG;

  var el = {};
  var wired = false;

  var SCREENS = ['menu', 'boot', 'briefing', 'victory', 'defeat', 'pause', 'complete', 'levelup', 'difficulty'];

  var bootQueue = [];
  var bootTimer = null;
  var bootDone = false;

  // ==========================================
  // SETUP
  // ==========================================

  function cache() {
    el.app        = document.getElementById('app');
    el.canvas     = document.getElementById('game');
    el.radar      = document.getElementById('radar');
    el.hud        = document.getElementById('hud');

    el.objective  = document.getElementById('objective-text');
    el.distance   = document.getElementById('objective-distance');
    el.missionNm  = document.getElementById('mission-name');
    el.timer      = document.getElementById('mission-timer');

    el.shieldFill = document.getElementById('shield-fill');
    el.energyFill = document.getElementById('energy-fill');
    el.stationWrap= document.getElementById('station-bar-wrap');
    el.stationFill= document.getElementById('station-fill');

    el.dashCd     = document.getElementById('dash-cooldown');
    el.overdrive  = document.getElementById('overdrive-fill');

    // V2: barra de XP, laser, level up, buffs
    el.xpWrap     = document.getElementById('xp-bar-wrap');
    el.xpFill     = document.getElementById('xp-fill');
    el.xpText     = document.getElementById('xp-text');
    el.laserWrap  = document.getElementById('laser-cooldown');
    el.laserFill  = document.getElementById('laser-fill');
    el.laserKey   = document.getElementById('laser-key');
    el.buffs      = document.getElementById('buff-bar');
    el.levelTitle = document.getElementById('levelup-title');
    el.levelOpts  = document.getElementById('levelup-options');

    el.alert      = document.getElementById('hud-alert');
    el.score      = document.getElementById('score-value');
    el.hint       = document.getElementById('hint-bar');
    el.prompt     = document.getElementById('interact-prompt');
    el.log        = document.getElementById('hud-log');

    el.screens = {};
    for (var i = 0; i < SCREENS.length; i++) {
      el.screens[SCREENS[i]] = document.getElementById(SCREENS[i]);
    }

    el.bootLog     = document.getElementById('boot-log');
    el.bootCont    = document.getElementById('boot-continue');

    el.brTitle     = document.getElementById('briefing-title');
    el.brText      = document.getElementById('briefing-text');
    el.brObjectives= document.getElementById('briefing-objectives');
    el.brConcept   = document.getElementById('brief-concept');
    el.brConceptName=document.getElementById('brief-concept-name');
    el.brConceptLine=document.getElementById('brief-concept-line');

    el.victoryStats= document.getElementById('victory-stats');
    el.victoryRank = document.getElementById('victory-rank');
    el.defeatTitle = document.getElementById('defeat-title');
    el.defeatReason= document.getElementById('defeat-reason');
    el.completeStats = document.getElementById('complete-stats');
    el.completeRank  = document.getElementById('complete-rank');
    el.vLesson       = document.getElementById('victory-lesson');
    el.vLessonConcept= document.getElementById('lesson-concept');
    el.vLessonLines  = document.getElementById('lesson-lines');
    el.vChallenge    = document.getElementById('victory-challenge');
    el.vChallengeText= document.getElementById('challenge-text');
    el.vChallengeStat= document.getElementById('challenge-status');

    el.btnStart    = document.getElementById('btn-start');
    el.btnFullscreen = document.getElementById('btn-fullscreen');
    el.btnDeploy   = document.getElementById('btn-deploy');
    el.btnNext     = document.getElementById('btn-next-mission');
    el.btnBackMenu = document.getElementById('btn-back-menu');
    el.btnRetry    = document.getElementById('btn-retry');
    el.btnDefeatMenu = document.getElementById('btn-defeat-menu');
    el.btnResume   = document.getElementById('btn-resume');
    el.btnRestart  = document.getElementById('btn-restart');
    el.btnPauseMenu = document.getElementById('btn-pause-menu');
    el.btnCompleteMenu = document.getElementById('btn-complete-menu');
  }

  function on(node, fn) {
    if (!node) return;
    node.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      MC.audio.unlock();
      MC.audio.SFX.uiClick();
      fn();
    });
    node.addEventListener('mouseenter', function () {
      MC.audio.SFX.uiHover();
    });
  }

  function wire() {
    if (wired) return;
    wired = true;

    on(el.btnStart,      function () {
      MC.game.showDifficulty();
    });
    on(el.btnFullscreen, toggleFullscreen);
    on(el.btnDeploy,     function () { MC.game.startGameplay(); });
    on(el.btnNext,       function () { MC.game.nextMission(); });
    on(el.btnBackMenu,   function () { MC.game.backToMenu(); });
    on(el.btnRetry,      function () { MC.game.restartMission(); });
    on(el.btnDefeatMenu, function () { MC.game.backToMenu(); });
    on(el.btnResume,     function () { MC.game.resumeGame(); });
    on(el.btnRestart,    function () { MC.game.restartMission(); });
    on(el.btnPauseMenu,  function () { MC.game.backToMenu(); });
    on(el.btnCompleteMenu, function () { MC.game.backToMenu(); });

    var btnNorm = document.getElementById('btn-diff-normal');
    var btnHard = document.getElementById('btn-diff-hard');
    var btnDiffBack = document.getElementById('btn-diff-back');
    on(btnNorm, function () { MC.game.setDifficulty('normal'); MC.game.startBootFromMenu(); });
    on(btnHard, function () { MC.game.setDifficulty('hard'); MC.game.startBootFromMenu(); });
    on(btnDiffBack, function () { MC.game.backToMenu(); });
  }

  function init() {
    cache();
    wire();
    showScreen('menu');
    return true;
  }

  // ==========================================
  // TELAS
  // ==========================================

  function showScreen(name) {
    for (var i = 0; i < SCREENS.length; i++) {
      var node = el.screens[SCREENS[i]];
      if (!node) continue;
      node.classList.toggle('hidden', SCREENS[i] !== name);
    }

    // HUD só aparece durante o jogo
    if (el.hud) el.hud.classList.toggle('hidden', name !== null);

    // Cursor do sistema some durante o jogo (name === null)
    MC.input.setCursorVisible(name !== null);

    // A camada de aprendizado só existe na tela de vitória
    if (name !== 'victory') {
      if (el.vLesson) el.vLesson.classList.add('hidden');
      if (el.vChallenge) el.vChallenge.classList.add('hidden');
    }
  }

  function showDifficulty() {
    showScreen('difficulty');
  }

  function hideAllScreens() { showScreen(null); }

  // ==========================================
  // TELA DE BOOT
  // ==========================================

  var BOOT_LINES = [
    'MECH-CORE v4.12 .................. OK',
    'Conexão com a Central ........... OK',
    'Calibrando estabilizadores ....... OK',
    'Carregando perfil do cadete ..... OK',
    'Verificando blindagem ............ OK',
    '',
    '> SISTEMA PRONTO',
    '> Bem-vindo à Defesa Orbital.',
  ];

  function resetBoot() {
    if (bootTimer) { clearInterval(bootTimer); bootTimer = null; }
    bootQueue = BOOT_LINES.slice();
    bootDone = false;
    if (el.bootLog) el.bootLog.textContent = '';
    if (el.bootCont) el.bootCont.classList.add('hidden');
  }

  function runBoot() {
    if (bootTimer) return;

    bootTimer = setInterval(function () {
      if (bootQueue.length === 0) {
        clearInterval(bootTimer);
        bootTimer = null;
        bootDone = true;
        MC.audio.SFX.bootOnline();
        if (el.bootCont) el.bootCont.classList.remove('hidden');
        return;
      }
      var line = bootQueue.shift();
      if (el.bootLog) el.bootLog.textContent += line + '\n';
      MC.audio.SFX.bootLine();
    }, 380);
  }

  function isBootDone() { return bootDone; }

  // ==========================================
  // BRIEFING
  // ==========================================

  function showBriefing(data, index, total) {
    if (el.brTitle) {
      el.brTitle.textContent = data.title;
    }
    if (el.brText) {
      el.brText.textContent = data.briefing;
    }
    if (el.brObjectives) {
      el.brObjectives.innerHTML = '';
      var head = document.createElement('strong');
      head.textContent = 'OBJETIVOS (' + (index + 1) + '/' + total + '):';
      el.brObjectives.appendChild(head);

      for (var i = 0; i < data.objectives.length; i++) {
        var li = document.createElement('li');
        li.textContent = data.objectives[i];
        el.brObjectives.appendChild(li);
      }
    }
    if (el.brConcept) {
      if (data.concept) {
        el.brConceptName.textContent = data.concept;
        el.brConceptLine.textContent = data.conceptLine || '';
        el.brConcept.classList.remove('hidden');
      } else {
        el.brConcept.classList.add('hidden');
      }
    }
    showScreen('briefing');
  }

  // ==========================================
  // HUD
  // ==========================================

  function setMissionName(text) {
    if (el.missionNm) el.missionNm.textContent = text;
  }

  function setScore(value) {
    if (el.score) el.score.textContent = Math.floor(value);
  }

  function setAlert(text, tone) {
    if (!el.alert) return;
    if (!text) {
      el.alert.classList.add('hidden');
      return;
    }
    el.alert.textContent = text;
    el.alert.classList.remove('hidden');
    el.alert.classList.toggle('danger', tone === 'danger');
  }

  function setHint(text) {
    if (!el.hint) return;
    if (!text) {
      el.hint.classList.add('hidden');
      return;
    }
    el.hint.textContent = text;
    el.hint.classList.remove('hidden');
  }

  /** Prompt de interação ("[E] ABRIR COMPORTA") no centro da tela. */
  function setPrompt(text) {
    if (!el.prompt) return;
    if (!text) {
      el.prompt.classList.add('hidden');
      return;
    }
    el.prompt.textContent = text;
    el.prompt.classList.remove('hidden');
  }

  function renderLog(events) {
    if (!el.log) return;
    var out = '';
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var color = ev.tone === 'good' ? '#00ff88'
                : ev.tone === 'bad'  ? '#ff4d5a'
                : '#8ab4d4';
      var alpha = Math.max(0.25, 1 - ev.time / 5);
      out += '<div style="color:' + color + ';opacity:' + alpha.toFixed(2) + '">&gt; ' +
             escapeHtml(ev.text) + '</div>';
    }
    el.log.innerHTML = out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /**
   * Atualiza o HUD.
   * @param player objeto do jogador
   * @param ms     estado da missão
   * @param target alvo atual {x, y, label} ou null
   */
  function updateHUD(player, ms, target) {
    if (!player) return;

    // Objetivo + direção
    if (el.objective) {
      el.objective.textContent = MC.missions.objectiveText(ms) || '—';
    }
    if (el.distance) {
      if (target) {
        var d = Math.round(U.dist(player.x, player.y, target.x, target.y));
        el.distance.textContent = '➜ ' + target.label + ' a ' + d + 'm';
      } else {
        el.distance.textContent = '';
      }
    }

    // Tempo
    if (el.timer && ms) {
      el.timer.textContent = U.formatTime(ms.time);
      el.timer.classList.toggle('danger', ms.time <= 15);
    }

    // Barras
    if (el.shieldFill) {
      var sp = U.clamp(player.shield / player.maxShield, 0, 1);
      el.shieldFill.style.width = (sp * 100) + '%';
      el.shieldFill.classList.toggle('damaged', sp < 0.35);
    }
    if (el.energyFill) {
      el.energyFill.style.width =
        (U.clamp(player.energy / player.maxEnergy, 0, 1) * 100) + '%';
    }

    // Habilidades
    if (el.dashCd) {
      var dashPct = player.dashCooldown > 0
        ? 1 - player.dashCooldown / C.player.dashCooldown
        : 1;
      el.dashCd.style.height = (U.clamp(dashPct, 0, 1) * 100) + '%';
    }
    if (el.overdrive) {
      el.overdrive.style.height =
        (U.clamp(player.overdrive / player.maxOverdrive, 0, 1) * 100) + '%';
    }

    // Barra da estação (só na missão de defesa)
    if (el.stationWrap && el.stationFill) {
      if (ms && ms.data.station) {
        el.stationWrap.classList.remove('hidden');
        var pct = U.clamp(ms.stationHealth / ms.data.station.maxHealth, 0, 1);
        el.stationFill.style.width = (pct * 100) + '%';
      } else {
        el.stationWrap.classList.add('hidden');
      }
    }

    // ---- V2: XP e nível ----
    if (el.xpWrap) {
      var need = MC.xp.neededFor(player.level);
      if (!isFinite(need)) {
        // Nível máximo: barra cheia e sem número de "faltam X"
        el.xpFill.style.width = '100%';
        if (el.xpText) el.xpText.textContent = 'NÍVEL MÁX.';
      } else {
        el.xpFill.style.width = (MC.xp.progress(player) * 100) + '%';
        if (el.xpText) {
          el.xpText.textContent =
            'NÍVEL ' + player.level + '  •  ' + Math.floor(player.xp) + '/' + need;
        }
      }
    }

    // ---- V2: laser tático ----
    if (el.laserWrap) {
      if (MC.laser.isUnlocked(player)) {
        el.laserWrap.classList.remove('hidden');
        var ready = MC.laser.readiness(player);
        el.laserFill.style.height = (ready * 100) + '%';
        // Pulsa quando disponível: o olho acha antes da leitura.
        el.laserWrap.classList.toggle('ready', ready >= 1);
      } else {
        el.laserWrap.classList.add('hidden');
      }
    }

    // ---- V2: power-ups ativos ----
    if (el.buffs) renderBuffs(player);

    // Log de eventos
    if (ms) renderLog(ms.events);
  }

  /** Desenha os power-ups ativos com o tempo restante. */
  function renderBuffs(player) {
    var list = MC.powerups.active(player);
    if (!list.length) {
      el.buffs.innerHTML = '';
      return;
    }

    var out = '';
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      out += '<span class="buff" style="color:' + b.info.color + '">' +
             escapeHtml(b.info.label) +
             '<i>' + b.time.toFixed(1) + 's</i></span>';
    }
    el.buffs.innerHTML = out;
  }

  // ==========================================
  // V2 — LEVEL UP
  // ==========================================

  /**
   * Monta a tela de escolha de melhoria.
   * @param payload null para fechar a tela
   *               { level, options, onPick }
   */
  function setLevelUp(payload) {
    if (!payload) {
      if (el.levelOpts) el.levelOpts.innerHTML = '';
      if (el.levelTitle) el.levelTitle.textContent = '';
      return;
    }

    if (el.levelTitle) {
      el.levelTitle.textContent = 'NÍVEL ' + payload.level + ' — ESCOLHA UM UPGRADE';
    }
    if (!el.levelOpts) return;

    // Reconstrói a cada chamada: são 3 botões, não vale caching.
    el.levelOpts.innerHTML = '';
    payload.options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.className = 'upgrade-card';
      btn.style.setProperty('--rarity', opt.color);

      var stackTxt = opt.maxStacks > 1
        ? '<div class="upgrade-stacks">+' + (opt.stacks + 1) + ' / ' + opt.maxStacks + '</div>'
        : '';

      btn.innerHTML =
        '<div class="upgrade-icon">' + opt.icon + '</div>' +
        '<div class="upgrade-name">' + escapeHtml(opt.name) + '</div>' +
        '<div class="upgrade-desc">' + escapeHtml(opt.desc) + '</div>' +
        '<div class="upgrade-rarity">' + rarityLabel(opt.rarity) + '</div>' +
        stackTxt;

      on(btn, function () { payload.onPick(opt.id); });
      el.levelOpts.appendChild(btn);
    });
  }

  function rarityLabel(r) {
    switch (r) {
      case 'uncommon': return 'INCOMUM';
      case 'rare': return 'RARO';
      case 'epic': return 'ESPECIAL';
      default: return 'COMUM';
    }
  }

  /**
   * Mostra um evento temporário no HUD. Usado pelo Activity Director
   * para as dicas de anti-ociosidade, que não vêm da missão.
   */
  function pushEvent(text, tone, duration) {
    if (!el.alert) return;
    el.alert.textContent = text;
    el.alert.classList.remove('hidden', 'danger');
    if (tone === 'good') el.alert.style.color = MC.COLORS.success;
    else if (tone === 'bad') el.alert.style.color = MC.COLORS.danger;
    else el.alert.style.color = '';

    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      el.alert.classList.add('hidden');
      el.alert.style.color = '';
    }, (duration || 3) * 1000);
  }

  var hintTimer = null;

  // ==========================================
  // RESULTADO
  // ==========================================

  function showVictory(info) {
    if (el.victoryStats) {
      el.victoryStats.innerHTML =
        'Tempo: <b>' + info.time + '</b> &nbsp;•&nbsp; ' +
        'Pontos: <b>' + info.score + '</b><br>' +
        'Inimigos desativados: <b>' + info.enemies + '</b> &nbsp;•&nbsp; ' +
        'Células: <b>' + info.cells + '</b>';
    }
    if (el.victoryRank) {
      var rank = MC.storage.rankForScore(info.score);
      el.victoryRank.textContent = 'PATENTE: ' + rank.name;
    }
    if (el.btnNext) {
      el.btnNext.textContent = info.isLast ? 'CONCLUIR TREINAMENTO' : 'PRÓXIMA MISSÃO';
    }

    // ---- Búfica da Central: o conceito que a criança acabou de usar ----
    if (el.vLesson) {
      if (info.lesson && info.lesson.length) {
        el.vLessonConcept.textContent = info.concept || '';
        el.vLessonLines.innerHTML = '';
        for (var i = 0; i < info.lesson.length; i++) {
          var li = document.createElement('li');
          li.textContent = info.lesson[i];
          el.vLessonLines.appendChild(li);
        }
        el.vLesson.classList.remove('hidden');
      } else {
        el.vLesson.classList.add('hidden');
      }
    }

    // ---- Desafio bônus ----
    if (el.vChallenge) {
      if (info.challenge && info.challenge.text) {
        var ch = info.challenge;
        el.vChallengeText.textContent = ch.text;
        el.vChallengeStat.textContent = ch.ok
          ? 'CUMPRIDO  +' + ch.bonus + ' pts'
          : 'não cumprido' + (ch.label ? ' (' + ch.label + ')' : '');
        el.vChallengeStat.className = ch.ok ? 'ok' : 'miss';
        el.vChallenge.classList.remove('hidden');
        el.vChallenge.classList.toggle('done', !!ch.ok);
      } else {
        el.vChallenge.classList.add('hidden');
      }
    }

    showScreen('victory');
  }

  /**
 * @param reason  motivo já formatado (ex.: "TEMPO ESGOTADO")
 * @param title   título do quadro (padrão: "MISSÃO NÃO CONCLUÍDA")
 */
  function showDefeat(reason, title) {
    if (el.defeatTitle) {
      el.defeatTitle.textContent = title || 'MISSÃO NÃO CONCLUÍDA';
    }
    if (el.defeatReason) el.defeatReason.textContent = reason || '';
    showScreen('defeat');
  }

  function showComplete(info) {
    if (el.completeStats) {
      var totalPhases = MC.MISSIONS.length;
      var miniBossDone = info.miniBossDefeated ? 'SIM' : (info.miniBossDone ? 'SIM' : 'N/D');
      var finalBossDone = info.finalBossDefeated ? 'SIM' : (info.finalBossDone ? 'SIM' : 'N/D');
      el.completeStats.innerHTML =
        '<b>CAMPANHA COMPLETA</b><br><br>' +
        'Fases concluídas: <b>' + (info.missions || totalPhases) + '/' + (info.total || totalPhases) + '</b><br>' +
        'Mini-Chefe derrotado (Fase 5): <b>' + miniBossDone + '</b><br>' +
        'Null Titan derrotado (Fase 10): <b>' + finalBossDone + '</b><br>' +
        'Pontuação: <b>' + info.totalScore + '</b>';
    }
    if (el.completeRank) {
      var rank = MC.storage.rankForScore(info.totalScore);
      el.completeRank.textContent = 'PATENTE FINAL: ' + rank.name;
    }
    if (el.completeConcepts) {
      var concepts = ['SEQUÊNCIA', 'CONDIÇÕES', 'CICLOS', 'SENSORES', 'VARIÁVEIS', 'ALGORITMOS', 'AND/OR', 'ESTADOS'];
      el.completeConcepts.innerHTML = concepts.map(function (c) { return '<span class="concept">' + c + '</span>'; }).join(' ');
    }
    showScreen('complete');
  }

  // ==========================================
  // UTILITÁRIOS
  // ==========================================

  function toggleFullscreen() {
    var doc = document;
    var d = doc.documentElement;

    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
      var req = d.requestFullscreen || d.webkitRequestFullscreen;
      if (req) {
        try { req.call(d); } catch (err) { /* ignorado */ }
      }
    } else {
      var exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exit) {
        try { exit.call(doc); } catch (err) { /* ignorado */ }
      }
    }
  }

  MC.ui = {
    init: init,
    showScreen: showScreen,
    hideAllScreens: hideAllScreens,

    resetBoot: resetBoot,
    runBoot: runBoot,
    isBootDone: isBootDone,

    showBriefing: showBriefing,
    setMissionName: setMissionName,
    setScore: setScore,
    setAlert: setAlert,
    setHint: setHint,
    setPrompt: setPrompt,
    pushEvent: pushEvent,
    updateHUD: updateHUD,
    setLevelUp: setLevelUp,

    showVictory: showVictory,
    showDefeat: showDefeat,
    showComplete: showComplete,
    toggleFullscreen: toggleFullscreen,

    getCanvas: function () { return el.canvas; },
    getRadar: function () { return el.radar; },
    showDifficulty: showDifficulty,
  };

})(window);