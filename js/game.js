/* ============================================
   MECH//CADET — Núcleo do jogo
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;
  var U = MC.utils;
  var E = MC.entities;
  var M = MC.missions;
  var SFX = MC.audio.SFX;

  var state = {
    scene: 'menu',        // menu | boot | briefing | gameplay | victory | defeat | pause | levelup
    paused: false,
    levelUpOpen: false,
    player: null,
    mission: null,
    world: null,
    missionIndex: 0,
    totalScore: 0,
    target: null,
    profile: null,
    difficultyMode: C.difficulty.mode || 'hard',
    time: 0,
    hintTimer: 0,
    hintIndex: 0,
    resultTimer: 0,
    resultShown: false,
    persistentUpgrades: null,
    persistentMods: null,
  };

  var lastTs = 0;

  // ==========================================
  // PERFIL
  // ==========================================

  function loadProfile() {
    var p = MC.storage.loadProfile();
    if (!p) {
      p = {
        name: MC.storage.generateName(),
        missionsDone: [],
        createdAt: Date.now(),
      };
      MC.storage.saveProfile(p);
    }
    state.profile = p;
    return p;
  }

  function setDifficulty(mode) {
    if (!mode) return state.difficultyMode || C.difficulty.mode || 'hard';
    state.difficultyMode = (mode === 'normal' || mode === 'hard') ? mode : 'hard';
    C.difficulty.mode = state.difficultyMode;
    return state.difficultyMode;
  }

  function getDifficultyMode() {
    return state.difficultyMode || C.difficulty.mode || 'hard';
  }

  function getDifficultyProfile() {
    return C.getDifficultyProfile(getDifficultyMode());
  }

  function saveProfile() {
    if (state.profile) MC.storage.saveProfile(state.profile);
  }

  // ==========================================
  // TRANSIÇÕES DE CENA
  // ==========================================

  function startBoot() {
    MC.audio.unlock();
    MC.audio.startMusic();

    state.scene = 'boot';
    state.paused = false;
    MC.ui.resetBoot();
    MC.ui.setAlert(null);
    MC.ui.setHint(null);
    MC.ui.showScreen('boot');
    MC.ui.runBoot();
  }

  function startBriefing() {
    if (state.missionIndex >= MC.MISSIONS.length) state.missionIndex = 0;

    var data = MC.MISSIONS[state.missionIndex];
    state.scene = 'briefing';
    state.paused = false;

    MC.ui.setMissionName(data.title);
    MC.ui.showBriefing(data, state.missionIndex, MC.MISSIONS.length);
  }

  function startFromDifficulty() {
    state.scene = 'briefing';
    state.paused = false;
    MC.ui.setAlert(null);
    MC.ui.setHint(null);
    // vai direto para briefing da missão atual
    if (state.missionIndex >= MC.MISSIONS.length) state.missionIndex = 0;
    var data = MC.MISSIONS[state.missionIndex];
    MC.ui.setMissionName(data.title);
    MC.ui.showBriefing(data, state.missionIndex, MC.MISSIONS.length);
    MC.ui.showScreen('briefing');
  }

  function buildWorld(data) {
    return {
      width: C.world.width,
      height: C.world.height,
      obstacles: E.generateObstacles(data, C.world.width, C.world.height, C.world.obstacleCount),
    };
  }

  function startGameplay(index) {
    if (typeof index === 'number') state.missionIndex = index;

    var data = MC.MISSIONS[state.missionIndex];
    if (!data) { state.missionIndex = 0; data = MC.MISSIONS[0]; }

    // Aplica perfil de dificuldade selecionado
    var mode = getDifficultyMode();
    var prof = C.getDifficultyProfile(mode);
    var diffCfg = C.difficulty;
    for (var k in prof) {
      if (Object.prototype.hasOwnProperty.call(prof, k)) {
        diffCfg[k] = prof[k];
      }
    }
    diffCfg.mode = mode;

    // Devolve os objetos da fase anterior aos pools antes de descartar.
    // Sem isso, `made` cresce a cada troca de fase e o pooling deixa
    // de fazer o trabalho dele.
    if (state.mission) MC.spawner.dispose(state.mission);

    state.world = buildWorld(data);
    state.player = E.createPlayer(data.start.x, data.start.y);
    if (state.persistentUpgrades) {
      state.player.upgrades = state.persistentUpgrades;
    }
    if (state.persistentMods) {
      state.player.mods = state.persistentMods;
    }
    MC.upgrades.recalc(state.player);
    state.mission = M.create(data);
    state.mission.projectiles = [];
    state.mission.cells = [];
    state.mission.world = state.world;
    state.mission.playerRef = state.player;

    // V2: o laser tático é liberado por fase, não globalmente
    if (data.laserUnlocked) MC.laser.unlock(state.player);
    else state.player.laserCooldown = 0;

    // Inimigos iniciais
    (data.enemies || []).forEach(function (e) {
      var en = E.createEnemy(e.type, e.x, e.y);
      if (en) state.mission.enemies.push(en);
    });

    state.scene = 'gameplay';
    state.paused = false;
    state.levelUpOpen = false;
    state.resultShown = false;
    state.resultTimer = 0;
    state.hintTimer = data.hints && data.hints.length ? 14 : 0;
    state.hintIndex = 0;
    state.pendingLevels = 0;

    MC.particles.clear();
    MC.activityDirector.reset();
    MC.spawner.director.reset();
    MC.renderer.snapCamera(state.player, state.world);
    MC.ui.setScore(0);
    MC.ui.setAlert(null);
    MC.ui.setPrompt(null);
    MC.ui.setMissionName(data.title);
    MC.ui.setLevelUp(null);
    MC.ui.showScreen(null);
    MC.audio.unlock();
    MC.audio.startMusic();
  }

  function missionComplete() {
    var ms = state.mission;
    if (!ms) return;

    // Bônus só para quem termina dentro do tempo-alvo
    var targetLeft = Math.max(0, (ms.data.timeLimit || 0) - (ms.data.targetTime || 0));
    var timeBonus = Math.max(0, Math.round(ms.time) - targetLeft) * C.scoring.timeBonusPerSecond;
    ms.score += timeBonus;

    // Desafio bônus: avalia a "lição" prática da missão
    var challenge = M.checkChallenge(ms, state.player);
    if (challenge.ok) {
      ms.score += challenge.bonus;
      M.pushEvent(ms, 'DESAFIO BÔNUS CUMPRIDO  +' + challenge.bonus, 'good');
      SFX.objective();
    }

    state.totalScore += ms.score;

    if (state.profile) {
      var done = state.profile.missionsDone || (state.profile.missionsDone = []);
      if (done.indexOf(ms.data.id) === -1) done.push(ms.data.id);
      saveProfile();
    }

    MC.storage.saveScore({
      mission: ms.data.id,
      score: ms.score,
      date: Date.now(),
    });

    state.scene = 'victory';
    state.paused = false;
    MC.audio.SFX.victory();
    MC.ui.setHint(null);
    MC.ui.setAlert(null);
    MC.ui.setPrompt(null);
    MC.ui.showVictory({
      time: U.formatTime(ms.data.timeLimit - ms.time),
      score: ms.score,
      enemies: state.player ? state.player.kills : 0,
      cells: state.player ? state.player.cellsCollected : 0,
      isLast: state.missionIndex >= MC.MISSIONS.length - 1,
      concept: ms.data.concept,
      lesson: ms.data.lesson,
      challenge: {
        text: ms.data.challenge ? ms.data.challenge.text : '',
        ok: challenge.ok,
        bonus: challenge.bonus,
        label: challenge.label,
      },
    });
  }

  function missionFailed(reason) {
    state.scene = 'defeat';
    state.paused = false;
    MC.ui.setHint(null);
    MC.ui.setAlert(null);
    MC.ui.setPrompt(null);

    // O título precisa refletir o motivo real da falha
    var titles = {
      'TEMPO ESGOTADO': 'TEMPO ESGOTADO',
      'MECH DESATIVADO': 'MECH DESATIVADO',
      'ESTAÇÃO DESTRUÍDA': 'ESTAÇÃO DESTRUÍDA',
    };
    MC.ui.showDefeat(reason || 'Não foi desta vez!', titles[reason]);
  }

  function nextMission() {
    // Última missão da campanha
    if (state.missionIndex >= MC.MISSIONS.length - 1) {
      state.scene = 'complete';
      state.paused = false;
      MC.ui.setPrompt(null);
      MC.ui.setHint(null);
      MC.ui.setAlert(null);
      MC.audio.SFX.victory();
      MC.ui.showComplete({
        missions: MC.MISSIONS.length,
        total: MC.MISSIONS.length,
        totalScore: state.totalScore,
        miniBossDefeated: true,
        finalBossDefeated: true,
      });
      return;
    }
    state.missionIndex++;
    startBriefing();
  }

  function restartMission() {
    MC.ui.setAlert(null);
    MC.ui.setHint(null);
    MC.ui.setPrompt(null);
    // Não reseta upgrades persistentes
    startGameplay(state.missionIndex);
  }

  function backToMenu() {
    state.scene = 'menu';
    state.paused = false;
    state.missionIndex = 0;
    state.player = null;
    state.mission = null;
    state.world = null;
    state.target = null;
    state.persistentUpgrades = null;
    state.persistentMods = null;
    MC.particles.clear();
    MC.ui.setAlert(null);
    MC.ui.setHint(null);
    MC.ui.setPrompt(null);
    MC.ui.showScreen('menu');
  }

  function pauseGame() {
    if (state.scene !== 'gameplay' || state.paused) return;
    state.paused = true;
    state.scene = 'pause';
    MC.ui.showScreen('pause');
    MC.ui.updatePauseScreen(state.player, state.mission);
  }

  function resumeGame() {
    if (!state.paused && state.scene !== 'pause') return;
    state.paused = false;
    state.scene = 'gameplay';
    MC.ui.showScreen(null);
    MC.audio.unlock();
  }

  function togglePause() {
    if (state.scene === 'gameplay') pauseGame();
    else if (state.scene === 'pause') resumeGame();
  }

  // ==========================================
  // V2 — PROGRESSAO E ESTIMULO
  // ==========================================

  /**
   * Abre a tela de escolha de level up. O jogo fica congelado
   * enquanto a tela estiver aberta (ver o `return` em updateGameplay).
   */
  function openLevelUp() {
    var p = state.player;
    state.levelUpOpen = true;
    state.paused = false;
    MC.audio.SFX.levelUp();

    var options = MC.upgrades.roll(p, 3);

    // Subiu de nível mas não há nada a escolher (todos no máximo).
    // Consolação: escudo + energia. E `pendingLevels` volta a zero,
    // senão a próxima fase abriria cartas sem parar.
    if (!options.length) {
      p.pendingLevels = 0;
      p.shield = p.maxShield;
      p.energy = p.maxEnergy;
      MC.ui.pushEvent('NÍVEL ' + p.level + ' — MECANISMO NO MÁXIMO', MC.COLORS.warning);
      MC.particles.ring(p.x, p.y, MC.COLORS.success, 70);
      state.levelUpOpen = false;
      return;
    }

    MC.ui.setLevelUp({
      level: p.level,
      options: options,
      onPick: function (id) {
        MC.upgrades.apply(p, id);
        state.persistentUpgrades = p.upgrades;
        state.persistentMods = p.mods;
        p.pendingLevels = Math.max(0, p.pendingLevels - 1);
        MC.audio.SFX.uiClick();
        MC.particles.ring(p.x, p.y, MC.COLORS.cyan, 60);

        if (p.pendingLevels > 0) {
          openLevelUp();            // subiu dois de uma vez
        } else {
          state.levelUpOpen = false;
          MC.ui.setLevelUp(null);
          MC.ui.showScreen(null);   // devolve o controle e o HUD
        }
      },
    });
    MC.ui.showScreen('levelup');
  }

  /**
   * Contexto que o Activity Director usa para decidir se a criança
   * está parada de verdade ou apenas parada num lugar estratégico.
   */
  function activityCtx(ms, p) {
    var input = MC.input;
    var mv = input.getMovementVector();
    var target = M.currentTarget(ms, p);
    var near = false;
    if (target) near = U.dist(p.x, p.y, target.x, target.y) < 140;

    var ctx = {
      isMoving: mv.length > 0.01,
      isFiring: input.isMouseDown(),
      threatCount: ms.enemies.length,
      nearObjective: near,
      onObjective: near,
      // Onde o grupo deve nascer: perto do objetivo, não em cima do
      // jogador. Assim a pressão empurra na direção da missão.
      ox: target ? target.x : p.x,
      oy: target ? target.y : p.y,
    };

    if (target) {
      var objText = M.objectiveText(ms);
      ctx.directionHint = 'OBJETIVO: ' + (objText || '').toUpperCase();
    }

    return ctx;
  }

  // ==========================================
  // COLISÕES
  // ==========================================

  function updateProjectiles(dt) {
    var ms = state.mission;
    var p = state.player;
    var list = ms.projectiles;

    // Toda remoção passa por aqui para devolver o objeto ao pool.
    // Um `splice` perdido aqui = vazamento silencioso de memória.
    function drop(i) {
      MC.pools.freeProjectile(list[i]);
      list.splice(i, 1);
    }

    for (var i = list.length - 1; i >= 0; i--) {
      var proj = list[i];
      E.updateProjectile(proj, dt, state.world);

      if (proj.life <= 0) { drop(i); continue; }

      if (proj.owner === 'player') {
        var hit = false;
        for (var e = 0; e < ms.enemies.length; e++) {
          var en = ms.enemies[e];
          if (!en.alive) continue;
          if (U.dist(proj.x, proj.y, en.x, en.y) < en.radius + proj.radius) {
            p.damageDealt += proj.damage;
            E.damageEnemy(en, proj.damage, ms);

            // Pulso Nova (upgrade épico): o tiro também fere por perto
            if (proj.nova) {
              var R = 74;
              for (var n = 0; n < ms.enemies.length; n++) {
                var o = ms.enemies[n];
                if (!o.alive || o === en) continue;
                if (U.dist(proj.x, proj.y, o.x, o.y) < R + o.radius) {
                  E.damageEnemy(o, proj.damage * 0.5, ms);
                }
              }
              MC.particles.ring(proj.x, proj.y, MC.COLORS.cyan, R);
            }

            hit = true;
            break;
          }
        }
        if (hit) { drop(i); continue; }

      } else {
        // Projétil inimigo
        if (p.alive && U.dist(proj.x, proj.y, p.x, p.y) < p.radius + proj.radius) {
          E.damagePlayer(p, proj.damage);
          drop(i);
          continue;
        }

        // Estações podem ser atingidas
        var st = ms.data.station;
        if (st && U.dist(proj.x, proj.y, st.x, st.y) < st.radius + proj.radius) {
          // Tiros inimigos só corroem a estação pela metade
          M.damageStation(ms, proj.damage * 0.5);
          MC.particles.sparks(proj.x, proj.y, MC.COLORS.warning, 8);
          drop(i);
          continue;
        }
      }
    }
  }

  function updateEnemies(dt) {
    var ms = state.mission;
    var p = state.player;
    var st = ms.data.station;

    for (var i = 0; i < ms.enemies.length; i++) {
      var e = ms.enemies[i];
      E.updateEnemy(e, p, dt, state.world, ms);

      // Inimigos corpo-a-corpo também corroem a estação (bem devagar)
      if (st && U.dist(e.x, e.y, st.x, st.y) < st.radius + e.radius) {
        M.damageStation(ms, e.damage * dt * 0.25);
        MC.particles.sparks(st.x, st.y, MC.COLORS.warning, 2);
      }
    }

    // Limpeza + devolução ao pool (V2). Também mede o pico, que vira
    // a métrica de performance do evento.
    MC.spawner.sweep(ms);
    if (ms.enemies.length > ms.peakEnemies) ms.peakEnemies = ms.enemies.length;

    if (ms.stationHitFlash > 0) {
      ms.stationHitFlash = Math.max(0, ms.stationHitFlash - dt);
    }
  }

  // ==========================================
  // UPDATE
  // ==========================================

  function updateGameplay(dt) {
    var p = state.player;
    var ms = state.mission;
    var input = MC.input;
    var cam = MC.renderer.getCamera();

    // Câmera primeiro (o jogador se moveu no frame anterior)
    MC.renderer.updateCamera(p, dt, state.world);

    // Ações
    if (input.justPressed('Space')) E.tryDash(p, input);
    if (input.justPressed('KeyQ')) E.tryOverdrive(p);

    // Laser Tático — Shift
    var k = input.keys || {};
    var laserKeyDown = input.justPressed('ShiftLeft') || input.justPressed('ShiftRight') || k.ShiftLeft || k.ShiftRight;
    if (laserKeyDown) {
      if (!MC.laser.fire(p, ms, p.angle)) MC.audio.SFX.laserDenied();
    }

    if (input.consumeClick() || input.isMouseDown()) {
      E.tryFire(p, input, cam, ms);
    }

    // Jogador
    E.updatePlayer(p, dt, input, state.world, cam);

    // Inimigos e projéteis: param assim que a missão acaba, para o
    // jogador não tomar dano durante a animação de conclusão
    if (ms.state === M.STATE.ACTIVE) {
      // Congelamento do tempo (power-up TEMPO LENTO): inimigos e a
      // estação em câmera lenta; o jogador continua normal.
      var enemyDt = dt * (p.buffs.timeFreeze > 0 ? 0.3 : 1);

      updateEnemies(enemyDt);
      updateProjectiles(dt);

      // ---- V2: coleta, progressão e estímulo ----
      // `xp.add` é o único ponto do jogo onde o XP do jogador sobe.
      // Concentrar aqui evita que um canto novo do código suba XP
      // sem passar pela verificação de level up.
      var xpColetado = MC.xp.update(ms, dt, p);
      MC.powerups.update(ms, dt, p);
      MC.laser.update(ms, dt, p);

      // Level up: pausa o jogo e abre a tela de escolhas
      if (MC.xp.add(p, xpColetado) > 0) {
        p.pendingLevels++;
        openLevelUp();
      }
      if (state.levelUpOpen) return;   // congela até a criança escolher

      MC.activityDirector.update(ms, dt, p, activityCtx(ms, p));

      // Survival: spawn intenso para fase de sobrevivência (4x base)
      if (ms.data.type === 'survival') {
        ms.survivalSpawnTimer = (ms.survivalSpawnTimer || 0) - dt;
        if (ms.survivalSpawnTimer <= 0 && ms.enemies.length < (C.difficulty.maxActiveEnemies || 14)) {
          ms.survivalSpawnTimer = 2 + Math.random() * 2; // 2-4s (muito mais frequente)
          // Spawn 3 inimigos por onda + chance de runner/shooter
          for (var spawnCount = 0; spawnCount < 3; spawnCount++) {
            var edge = Math.random() < 0.5 ? 0 : state.world.width;
            var ey = Math.random() * state.world.height;
            var type = Math.random() < 0.7 ? 'drone' : (Math.random() < 0.5 ? 'runner' : 'shooter');
            var en = E.createEnemy(type, edge, ey);
            if (en) ms.enemies.push(en);
          }
        }
      }

      // Enemy Director: ondas contínuas (desativado em survival/boss/finalBoss)
      if (ms.data.type !== 'survival' && ms.data.type !== 'boss' && ms.data.type !== 'finalBoss') {
        MC.spawner.director.update(ms, dt, state.target);
      }

      // Missão
      ms.exitReady = ms.stabilizers.every(function (s) { return s.disabled; });
      M.update(ms, dt, p, input, state.world);
    }

    // Alvo atual (seta de direção)
    state.target = M.currentTarget(ms, p);

    // Prompt de interação
    MC.ui.setPrompt(ms.prompt);

    // Alerta = evento mais recente
    if (ms.events.length > 0) {
      var newest = ms.events[ms.events.length - 1];
      MC.ui.setAlert(newest.text, newest.tone);
    } else {
      MC.ui.setAlert(null);
    }

    // Dicas
    if (state.hintTimer > 0) {
      state.hintTimer -= dt;
      var hints = ms.data.hints || [];
      var idx = Math.min(hints.length - 1,
        Math.floor((14 - state.hintTimer) / (14 / Math.max(1, hints.length))));
      if (idx >= 0 && hints[idx]) MC.ui.setHint(hints[idx]);
      if (state.hintTimer <= 0) MC.ui.setHint(null);
    }

    // HUD
    MC.ui.updateHUD(p, ms, state.target);

    // Resultado
    if (ms.state !== M.STATE.ACTIVE && !state.resultShown) {
      state.resultShown = true;
      state.resultTimer = 1.1;
    }
    if (state.resultShown) {
      state.resultTimer -= dt;
      if (state.resultTimer <= 0) {
        if (ms.state === M.STATE.SUCCESS) missionComplete();
        else missionFailed(ms.failReason);
        return;
      }
    }
  }

  function update(dt) {
    state.time += dt;
    MC.particles.update(dt);

    var input = MC.input;

    switch (state.scene) {
      case 'boot':
        if (MC.ui.isBootDone() &&
            (input.justPressed('Enter') || input.justPressed('Space') ||
             input.justPressed('NumpadEnter') || input.consumeClick())) {
          state.scene = 'menu';
          MC.ui.showScreen('menu');
        }
        break;

      case 'briefing':
        if (input.justPressed('Enter') || input.justPressed('Space')) {
          startGameplay();
        }
        break;

      case 'gameplay':
        // Tela de level up aberta: nada de input de jogo, nem ESC.
        if (state.levelUpOpen) break;
        if (input.justPressed('Escape') || input.justPressed('KeyP')) {
          pauseGame();
          break;
        }
        updateGameplay(dt);
        break;

      case 'pause':
        if (input.justPressed('Escape') || input.justPressed('KeyP')) {
          resumeGame();
        }
        break;
    }

    // Garante que cliques nos menus não vazem para o jogo
    input.consumeClick();
    input.endFrame();
  }

  // ==========================================
  // LOOP
  // ==========================================

  function frame(ts) {
    global.requestAnimationFrame(frame);

    if (!lastTs) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;

    // Evita saltos gigantes ao voltar de outra aba
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;

    try {
      update(dt);
    } catch (err) {
      console.error('[MECH//CADET] Erro no update:', err);
    }

    if (state.scene === 'gameplay' || state.scene === 'pause') {
      try {
        MC.renderer.render(state, dt);
      } catch (err2) {
        console.error('[MECH//CADET] Erro no render:', err2);
      }
    } else {
      // Fora do jogo o canvas fica limpo atrás das telas
      MC.renderer.clear();
    }
  }

  function start() {
    loadProfile();

    MC.ui.init();
    MC.input.init(MC.ui.getCanvas());
    MC.renderer.init(MC.ui.getCanvas(), MC.ui.getRadar());

    MC.ui.showScreen('menu');
    MC.ui.setMissionName('—');

    global.requestAnimationFrame(frame);
  }

  MC.game = {
    state: state,
    start: start,

    startBoot: startBoot,
    startBriefing: startBriefing,
    startGameplay: startGameplay,
    nextMission: nextMission,
    restartMission: restartMission,
    backToMenu: backToMenu,
    pauseGame: pauseGame,
    resumeGame: resumeGame,
    togglePause: togglePause,

    showDifficulty: function () {
      state.scene = 'difficulty';
      MC.ui.showDifficulty();
    },
    setDifficulty: setDifficulty,
    getDifficultyMode: getDifficultyMode,
    startBootFromMenu: startFromDifficulty,

    /** Avança a simulação manualmente (usado em testes/diagnóstico). */
    step: function (dt) { update(dt); },

    /** Simula N quadros seguidos de dt segundos. */
    simulate: function (seconds, dt) {
      dt = dt || 1 / 60;
      var n = Math.ceil(seconds / dt);
      for (var i = 0; i < n; i++) update(dt);
      return n;
    },
  };

})(window);