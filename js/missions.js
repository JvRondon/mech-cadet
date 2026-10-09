/* ============================================
   MECH//CADET — Sistema de Missões
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;
  var COLORS = MC.COLORS;
  var U = MC.utils;
  var E = MC.entities;
  var P = MC.particles;
  var SFX = MC.audio.SFX;

  var STATE = {
    ACTIVE: 'ACTIVE',
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
  };

  /**
   * Escada padrão de inimigos quando a fase não declara `enemyTypes`.
   * Cobre os três papéis da regra de composição: perseguir, atirar de
   * longe e chegar rápido. A campanha da V2 sobrescreve isto por fase.
   */
  var DEFAULT_LADDER = ['drone', 'runner', 'shooter', 'tank'];

  var missions = {};

  missions.STATE = STATE;

  /**
   * Solta uma célula de energia (coletável da V1, mantido na V2).
   * Vive aqui para que o spawner possa chamar sem conhecer o game.js.
   */
  missions.dropCell = function (st, x, y) {
    if (!st) return null;
    if (!st.cells) st.cells = [];

    // Não nasce dentro de obstáculo
    if (st.world && U.isInsideAnyRect(x, y, st.world.obstacles, 0)) {
      x = U.clamp(x, 60, st.world.width - 60);
      y = U.clamp(y, 60, st.world.height - 60);
      if (U.isInsideAnyRect(x, y, st.world.obstacles, 0)) return null;
    }

    st.cells.push(E.createCell(x, y));
    while (st.cells.length > 12) st.cells.shift();
    return st.cells[st.cells.length - 1];
  };

  /** Cria o estado runtime de uma missão a partir dos dados. */
  missions.create = function (data) {
    var st = {
      data: data,
      state: STATE.ACTIVE,
      time: data.timeLimit,       // tempo restante
      elapsed: 0,
      enemies: [],
      cells: [],
      projectiles: [],
      score: 0,
      events: [],                  // mensagens para a Central
      lastObjective: '',
      // V2: novos containers e referências
      xpOrbs: [],
      powerDrops: [],
      lasers: [],
      playerRef: null,
      allowedTypes: data.enemyTypes || DEFAULT_LADDER.slice(),
      boss: null,
      density: data.density || null,
      // guarda o pico de inimigos simultâneos (perf/telemetria)
      peakEnemies: 0,
    };

    // Estado específico por tipo
    st.waypointIndex = 0;
    st.dashUsedInZone = false;
    st.doorOpened = false;
    st.doorOpenedByPlayer = false;
    st.doorWait = 0;
    st.prompt = null;         // texto de interação disponível ("[E] ...")
    st.core = data.core ? E.createCore(data.core.x, data.core.y) : null;
    st.coreCaptured = false;
    st.waveIndex = 0;
    st.stationHealth = data.station ? data.station.maxHealth : 0;
    st.stabilizers = (data.stabilizers || []).map(function (s) {
      return {
        id: s.id, label: s.label,
        x: s.x, y: s.y, radius: s.radius,
        disabled: false,
        progress: 0,   // 0..1 enquanto o piloto mantém o掃 proximity
      };
    });
    st.guardianSpawned = false;
    st.exitReached = false;

    // Espelha os estabilizadores no objeto de dados para o renderer
    if (data.stabilizers) {
      data.stabilizers.forEach(function (s, i) { s.disabled = false; });
      void st;
    }

    return st;
  };

  missions.pushEvent = function (st, text, tone) {
    st.events.push({ text: text, tone: tone || 'info', time: 0 });
    if (st.events.length > 4) st.events.shift();
  };

  /** Texto do objetivo atual (usado no HUD). */
  missions.objectiveText = function (st) {
    if (!st) return '';

    switch (st.data.type) {
      case 'tutorial':
        var d = st.data;
        if (d.waypoints && d.waypoints.length && st.waypointIndex < d.waypoints.length) {
          return 'Calibragem ' + (st.waypointIndex + 1) + '/' + d.waypoints.length;
        }
        // FASE 3: 3 corredores de dash
        if (d.dashRequired && d.dashZones && d.dashZones.length && !st.dashUsedInZone) {
          if (!st.dashZonesDone) st.dashZonesDone = [];
          var done = 0;
          for (var i = 0; i < d.dashZones.length; i++) if (st.dashZonesDone[i]) done++;
          return 'Corredor ' + (done + 1) + '/' + d.dashZones.length + ' — DASH (ESPAÇO)';
        }
        // FASE 4: caixas de dados (laser)
        if (d.dataBoxes && d.dataBoxes.length) {
          var destroyed = st.boxesDestroyed || 0;
          return 'Caixa de Dados ' + (destroyed + 1) + '/' + d.dataBoxes.length + ' — LASER (SHIFT)';
        }
        if (!st.dashUsedInZone && d.dashRequired && d.dashZone) {
          return 'Atravesse o corredor (ESPAÇO)';
        }
        if (!st.doorOpened && d.door) return 'Abra a comporta (E)';
        if (d.exit) return 'Alcance a saída';
        if (d.waypoints && d.waypoints.length) return 'Calibragem completa';
        return 'Complete o objetivo';

      case 'capture':
        return st.coreCaptured ? 'Retorne à base' : 'Capture o núcleo';

      case 'defense':
        return 'Proteja a estação — ' + Math.ceil(st.time) + 's';

      case 'stabilizers':
        var n = countDisabled(st);
        if (n < st.stabilizers.length) return 'Estabilizadores ' + n + '/' + st.stabilizers.length;
        return 'Alcance a extração';

      case 'survival':
        return 'Sobreviva — ' + Math.ceil(st.time) + 's';

      case 'combat':
      case 'objective':
        return 'Derrote todos os inimigos';

      case 'waves':
        return 'Onda ' + (st.waveIndex + 1) + '/' + (st.data.waves ? st.data.waves.length : 0) + ' — ' + Math.ceil(st.time) + 's';

      case 'boss':
        return 'Derrote o Mini-Chefe';

      case 'finalBoss':
        return 'Derrote o Null Titan';
    }
    return '';
  };

  function countDisabled(st) {
    var n = 0;
    for (var i = 0; i < st.stabilizers.length; i++) {
      if (st.stabilizers[i].disabled) n++;
    }
    return n;
  }

  /**
   * Retorna o alvo atual para a seta direcional.
   * Formato: { x, y, label }
   */
  missions.currentTarget = function (st, player) {
    if (!st) return null;
    var d = st.data;

    switch (d.type) {
      case 'tutorial':
        if (d.waypoints && d.waypoints.length && st.waypointIndex < d.waypoints.length) {
          var wp = d.waypoints[st.waypointIndex];
          return { x: wp.x, y: wp.y, label: 'CAL' };
        }
        // FASE 3: múltiplos corredores de dash
        if (d.dashRequired && d.dashZones && d.dashZones.length && !st.dashUsedInZone) {
          if (!st.dashZonesDone) st.dashZonesDone = [];
          for (var i = 0; i < d.dashZones.length; i++) {
            if (!st.dashZonesDone[i]) {
              var zone = d.dashZones[i];
              return { x: zone.x + zone.width/2, y: zone.y + zone.height/2, label: zone.label };
            }
          }
          st.dashUsedInZone = true;
        }
        // FASE 4: caixas de dados (laser)
        if (d.dataBoxes && d.dataBoxes.length) {
          for (var i = 0; i < d.dataBoxes.length; i++) {
            var box = d.dataBoxes[i];
            if (box.hp > 0) {
              return { x: box.x, y: box.y, label: 'CAIXA ' + (i+1) };
            }
          }
        }
        // Após waypoints / porta legado
        if (d.exit) {
          return { x: d.exit.x, y: d.exit.y, label: 'SAÍDA' };
        }
        if (d.waypoints && d.waypoints.length) {
          var lastWp = d.waypoints[d.waypoints.length - 1];
          return { x: lastWp.x, y: lastWp.y, label: 'CAL' };
        }
        if (d.door) {
          var doorCx = d.door.x + d.door.width / 2;
          var doorCy = d.door.y + d.door.height / 2;
          return { x: doorCx, y: doorCy, label: 'PORTA' };
        }
        return null;

      case 'capture':
        if (!st.coreCaptured && st.core) return { x: st.core.x, y: st.core.y, label: 'NÚCLEO' };
        return { x: d.base.x, y: d.base.y, label: 'BASE' };

      case 'defense':
        return { x: d.station.x, y: d.station.y, label: 'ESTAÇÃO' };

      case 'stabilizers':
        if (countDisabled(st) < st.stabilizers.length) {
          // Estabilizador ativo mais próximo
          var best = null, bestD = Infinity;
          for (var i = 0; i < st.stabilizers.length; i++) {
            var s = st.stabilizers[i];
            if (s.disabled) continue;
            var dd = U.dist(player.x, player.y, s.x, s.y);
            if (dd < bestD) { bestD = dd; best = s; }
          }
          if (best) return { x: best.x, y: best.y, label: best.label };
        }
        return { x: d.exit.x, y: d.exit.y, label: 'SAÍDA' };
    }
    return null;
  };

  // ==========================================
  // ATUALIZAÇÃO
  // ==========================================

  missions.update = function (st, dt, player, input, world) {
    if (st.state !== STATE.ACTIVE) return;

    st.elapsed += dt;
    st.time -= dt;
    st.prompt = null;

    // Eventos envelhecem
    for (var i = st.events.length - 1; i >= 0; i--) {
      st.events[i].time += dt;
      if (st.events[i].time > 5) st.events.splice(i, 1);
    }

    if (st.time <= 0) {
      st.time = 0;
      // Na missão de defesa/sobrevivência/ondas, sobreviver ao tempo É o objetivo
      if (st.data.type === 'defense' || st.data.type === 'survival' || st.data.type === 'waves') {
        st.score += C.scoring.objective;
        missions.succeed(st);
      } else {
        missions.fail(st, 'TEMPO ESGOTADO');
      }
      return;
    }

    if (!player.alive) {
      missions.fail(st, 'MECH DESATIVADO');
      return;
    }

    switch (st.data.type) {
      case 'tutorial':   updateTutorial(st, dt, player, input); break;
      case 'capture':    updateCapture(st, dt, player); break;
      case 'defense':    updateDefense(st, dt, player); break;
      case 'stabilizers': updateStabilizers(st, dt, player); break;
      case 'boss':       updateBoss(st, dt, player); break;
      case 'finalBoss':  updateFinalBoss(st, dt, player); break;
      case 'combat':     updateCombat(st, dt, player); break;
      case 'objective':  updateObjective(st, dt, player); break;
      case 'survival':   updateSurvival(st, dt, player); break;
      case 'waves':      updateWaves(st, dt, player); break;
    }

    // Células de energia: coleta por proximidade
    for (var c = 0; c < st.cells.length; c++) {
      var cell = st.cells[c];
      if (!cell.alive) continue;
      E.updateCell(cell, dt);
      if (U.dist(player.x, player.y, cell.x, cell.y) < player.radius + cell.radius) {
        if (E.collectCell(cell, player)) {
          st.score += C.scoring.cell;
        }
      }
    }

    // Animação do núcleo
    if (st.core && !st.coreCaptured) st.core.phase += dt * 2;

    // Limpeza
    st.cells = st.cells.filter(function (c) { return c.alive; });
    st.enemies = st.enemies.filter(function (e) { return e.alive; });
  };

  // ---------- MISSÃO 00: TUTORIAL ----------
  function updateTutorial(st, dt, player, input) {
    var d = st.data;

    // FASE 1 & 2: Waypoints de calibragem
    if (d.waypoints && d.waypoints.length && st.waypointIndex < d.waypoints.length) {
      var wp = d.waypoints[st.waypointIndex];
      if (U.dist(player.x, player.y, wp.x, wp.y) < wp.radius) {
        st.waypointIndex++;
        st.score += 100;
        P.ring(wp.x, wp.y, COLORS.success, 30);
        SFX.objective();
        missions.pushEvent(st, 'CALIBRAGEM ' + st.waypointIndex + ' OK', 'good');
      }
      return;
    }

    // FASE 3: 3 Corredores de Dash (dashZones array)
    if (d.dashRequired && d.dashZones && d.dashZones.length) {
      if (!st.dashZonesDone) st.dashZonesDone = [];
      var allDone = true;
      for (var i = 0; i < d.dashZones.length; i++) {
        var zone = d.dashZones[i];
        var done = st.dashZonesDone[i];
        if (!done) {
          allDone = false;
          var inZone = player.x > zone.x && player.x < zone.x + zone.width &&
                       player.y > zone.y && player.y < zone.y + zone.height;
          st.prompt = inZone ? 'DASH (ESPAÇO) para atravessar ' + zone.label : null;
          if (inZone && player.dashing) {
            st.dashZonesDone[i] = true;
            st.score += 200;
            P.ring(player.x, player.y, COLORS.success, 38);
            SFX.objective();
            missions.pushEvent(st, zone.label + ' COMPLETO', 'good');
          }
        }
      }
      if (allDone) {
        st.dashUsedInZone = true; // marca fase 3 completa
        st.prompt = null;
        st.score += C.scoring.objective;
        missions.succeed(st);
      }
      return;
    }

    // FASE 4: Caixas de Dados - só Laser destrói
    if (d.dataBoxes && d.dataBoxes.length) {
      if (!st.boxesDestroyed) st.boxesDestroyed = 0;
      var allBoxesDone = true;
      for (var i = 0; i < d.dataBoxes.length; i++) {
        var box = d.dataBoxes[i];
        if (box.hp > 0) {
          allBoxesDone = false;
          // Verifica se laser atingiu a caixa
          if (st.lasers && st.lasers.length) {
            for (var li = 0; li < st.lasers.length; li++) {
              var laser = st.lasers[li];
              if (U.distToSegment(box.x, box.y, laser.x1, laser.y1, laser.x2, laser.y2) < box.radius + laser.width/2) {
                box.hp = 0;
                st.boxesDestroyed++;
                st.score += 300;
                P.explosion(box.x, box.y, COLORS.cyan, 30, 280);
                P.ring(box.x, box.y, COLORS.success, 40);
                SFX.objective();
                missions.pushEvent(st, 'CAIXA DE DADOS ' + (i+1) + ' ACESSADA', 'good');
                break;
              }
            }
          }
          st.prompt = 'SHIFT (Laser) na caixa';
        }
      }
      if (allBoxesDone) {
        st.score += C.scoring.objective;
        missions.succeed(st);
      }
      return;
    }

    // Fase 1 legado: porta
    if (d.door) {
      if (!st.doorOpened) {
        var cx = d.door.x + d.door.width / 2;
        var cy = d.door.y + d.door.height / 2;
        var inZone = U.dist(player.x, player.y, cx, cy) < 130;
        if (!inZone) { st.doorWait = 0; return; }
        st.prompt = '[E] ABRIR COMPORTA';
        var opened = false, byPlayer = false;
        if (input.justPressed('KeyE')) { opened = true; byPlayer = true; }
        else { st.doorWait += dt; if (st.doorWait >= 5) { opened = true; missions.pushEvent(st, 'COMPORTA RELEADA PELA CENTRAL', 'info'); } }
        if (opened) {
          st.doorOpened = true; st.doorOpenedByPlayer = byPlayer; st.doorWait = 0; st.prompt = null;
          st.score += C.scoring.objective; P.ring(cx,cy,COLORS.success,34); P.explosion(cx,cy,COLORS.success,24,240); SFX.objective();
          missions.pushEvent(st, 'COMPORTA ABERTA', 'good');
        }
        return;
      }
    }
    // Após waypoints concluídos e sem etapa bloqueante: sucesso automático
    st.score += C.scoring.objective;
    missions.succeed(st);
  }

  // ---------- MISSÃO 01: CAPTURA ----------
  function updateCapture(st, dt, player) {
    var d = st.data;

    if (!st.coreCaptured) {
      if (st.core && U.dist(player.x, player.y, st.core.x, st.core.y) < st.core.radius + player.radius + 14) {
        st.coreCaptured = true;
        st.score += C.scoring.coreCapture;
        P.ring(st.core.x, st.core.y, COLORS.cyan, 40);
        P.explosion(st.core.x, st.core.y, COLORS.cyan, 30, 280);
        SFX.objective();
        missions.pushEvent(st, 'NÚCLEO CAPTURADO — VOLTE', 'good');

        // Inimigos ficam mais rápidos após a captura
        var boost = d.enemyBoostOnCapture || 1;
        st.enemies.forEach(function (e) {
          e.speed *= boost;
          e.baseSpeed *= boost;
        });
      }
      return;
    }

    // Retorno à base
    if (U.dist(player.x, player.y, d.base.x, d.base.y) < d.base.radius) {
      st.score += C.scoring.objective;
      missions.succeed(st);
    }
  }

  // ---------- MISSÃO 02: DEFESA ----------
  function updateDefense(st, dt, player) {
    var d = st.data;

    // Spawna ondas
    while (st.waveIndex < d.waves.length) {
      var wave = d.waves[st.waveIndex];
      var elapsed = d.timeLimit - st.time;
      if (elapsed >= wave.at) {
        wave.enemies.forEach(function (e) {
          var en = E.createEnemy(e.type, e.x, e.y);
          if (en) {
            st.enemies.push(en);
            P.ring(en.x, en.y, COLORS.danger, 24);
          }
        });
        st.waveIndex++;
        SFX.warning();
        missions.pushEvent(st, 'ONDA ' + st.waveIndex + ' DETECTADA', 'bad');
      } else {
        break;
      }
    }

    // Integridade da estação
    if (st.stationHealth <= 0) {
      missions.fail(st, 'ESTAÇÃO DESTRUÍDA');
      return;
    }

    // Regenera Slowly se a estação não levar dano recente
    if (st.stationHealth < d.station.maxHealth) {
      st.stationHealth = Math.min(d.station.maxHealth, st.stationHealth + d.station.regen * dt);
    }

    // Vitória: sobreviver ao tempo é tratado em missions.update(),
    // no momento em que o contador chega a zero.
  }

  /** Aplica dano à estação (chamado pelo game loop quando um inimigo encosta). */
  missions.damageStation = function (st, amount) {
    if (!st.data.station) return;
    st.stationHealth = Math.max(0, st.stationHealth - amount);
    st.stationHitFlash = 0.3;
    if (st.stationHealth <= 0) missions.fail(st, 'ESTAÇÃO DESTRUÍDA');
  };

  // ---------- MISSÃO 03: ESTABILIZADORES ----------
  function updateStabilizers(st, dt, player) {
    var d = st.data;

    // Segurar perto de cada estabilizador para desligar
    for (var i = 0; i < st.stabilizers.length; i++) {
      var s = st.stabilizers[i];
      if (s.disabled) continue;

      var near = U.dist(player.x, player.y, s.x, s.y) < s.radius + player.radius + 30;
      if (near) {
        s.progress = Math.min(1, s.progress + dt / 1.0);
        if (s.progress >= 1) {
          s.disabled = true;
          st.score += 200;
          P.ring(s.x, s.y, COLORS.success, 40);
          P.explosion(s.x, s.y, COLORS.success, 26, 260);
          SFX.objective();
          missions.pushEvent(st, s.label + ' DESLIGADO', 'good');

          // Guardião desperta após o último
          if (countDisabled(st) >= st.stabilizers.length && !st.guardianSpawned) {
            st.guardianSpawned = true;
            var g = E.createEnemy(d.guardian.type, d.guardian.x, d.guardian.y);
            if (g) {
              st.enemies.push(g);
              P.explosion(g.x, g.y, COLORS.overdrive, 40, 320);
              P.ring(g.x, g.y, COLORS.overdrive, 50);
              SFX.warning();
              missions.pushEvent(st, 'GUARDIÃO ATIVADO', 'bad');
            }
          }
        }
      } else {
        s.progress = Math.max(0, s.progress - dt / 2);
      }
    }

    // Extração
    if (countDisabled(st) >= st.stabilizers.length) {
      if (U.dist(player.x, player.y, d.exit.x, d.exit.y) < d.exit.radius) {
        st.exitReached = true;
        st.score += C.scoring.objective;
        missions.succeed(st);
      }
    }
  }

  // ==========================================
  // CAMADA DE APRENDIZADO
  // ==========================================

  /**
   * Avalia o "desafio bônus" da missão contra o estado atual.
   * Só é chamado uma vez, no momento em que a missão termina.
   *
   * @returns {{ok: boolean, bonus: number, label: string}}
   */
  missions.checkChallenge = function (st, player) {
    var ch = st.data.challenge;
    if (!ch) return { ok: false, bonus: 0, label: '' };

    var ok = false;
    var current = '';

    switch (ch.key) {
      case 'doorByPlayer':
        current = st.doorOpenedByPlayer ? 'você apertou E' : 'a Central abriu por você';
        ok = !!st.doorOpenedByPlayer;
        break;

      case 'noDamage':
        current = player ? Math.floor(player.shield) + '/' + player.maxShield + ' de escudo' : '';
        ok = !!(player && player.shield >= player.maxShield);
        break;

      case 'station80':
        current = st.data.station
          ? Math.round((st.stationHealth / st.data.station.maxHealth) * 100) + '% de integridade'
          : '';
        ok = st.stationHealth >= st.data.station.maxHealth * 0.8;
        break;

      case 'fast90':
        current = U.formatTime(st.elapsed);
        ok = st.elapsed <= 90;
        break;

      default:
        current = '';
    }

    return {
      ok: ok,
      bonus: ok ? C.scoring.challenge : 0,
      label: current,
    };
  };

  // ==========================================
  // Conclusão
  // ==========================================

  missions.succeed = function (st) {
    if (st.state !== STATE.ACTIVE) return;
    st.state = STATE.SUCCESS;
    st.prompt = null;
    // O som de vitória é tocado pelo jogo, na hora de mostrar a tela
  };

  // ---------- MISSÕES 10 FASES ----------
  function updateCombat(st, dt, player) {
    var d = st.data;
    // Spawn inicial se não houver inimigos
    if (st.enemies.length === 0 && !st.initialSpawned) {
      st.initialSpawned = true;
      (d.enemies || []).forEach(function (e) {
        var en = E.createEnemy(e.type, e.x, e.y);
        if (en) st.enemies.push(en);
      });
    }
    // Vitória: todos inimigos derrotados
    if (st.enemies.length === 0 && st.initialSpawned) {
      st.score += C.scoring.objective;
      missions.succeed(st);
    }
  }

  function updateSurvival(st, dt, player) {
    var d = st.data;
    // Spawn inicial
    if (st.enemies.length === 0 && !st.initialSpawned) {
      st.initialSpawned = true;
      (d.enemies || []).forEach(function (e) {
        var en = E.createEnemy(e.type, e.x, e.y);
        if (en) st.enemies.push(en);
      });
    }
    // Sobreviver até o tempo acabar (tratado em missions.update)
  }

  function updateWaves(st, dt, player) {
    var d = st.data;
    // Spawna ondas baseadas no tempo decorrido
    while (st.waveIndex < (d.waves || []).length) {
      var wave = d.waves[st.waveIndex];
      var elapsed = d.timeLimit - st.time;
      if (elapsed >= wave.at) {
        (wave.enemies || []).forEach(function (e) {
          var en = E.createEnemy(e.type, e.x, e.y);
          if (en) st.enemies.push(en);
        });
        st.waveIndex++;
        SFX.warning();
        missions.pushEvent(st, 'ONDA ' + st.waveIndex + ' DETECTADA', 'bad');
      } else break;
    }
    // Vitória: tempo esgotado E última onda derrotada
    if (st.time <= 0 && st.waveIndex >= (d.waves || []).length && st.enemies.length === 0) {
      st.score += C.scoring.objective;
      missions.succeed(st);
    }
  }

  function updateBoss(st, dt, player) {
    var d = st.data;
    // Spawn boss se ainda não
    if (!st.boss && d.boss) {
      var boss = E.createEnemy(d.boss, d.bossX || 1000, d.bossY || 750, 1, 'mini');
      if (boss) {
        st.boss = boss;
        st.enemies.push(boss);
        P.explosion(boss.x, boss.y, COLORS.overdrive, 48, 360);
        SFX.warning();
        missions.pushEvent(st, 'CHEFE DETECTADO: ' + d.boss.toUpperCase(), 'bad');
      }
    }
    // Spawn de minions durante a luta do mini-chefe
    if (st.boss) {
      st.bossMinionTimer = (st.bossMinionTimer || 0) - dt;
      if (st.bossMinionTimer <= 0 && st.enemies.length < (C.difficulty.maxActiveEnemies || 14)) {
        st.bossMinionTimer = 8 + Math.random() * 5; // 8-13s
        var w = st.world ? st.world.width : 2000;
        var h = st.world ? st.world.height : 1500;
        var edge = Math.random() < 0.5 ? 0 : w;
        var ey = Math.random() * h;
        var type = Math.random() < 0.6 ? 'drone' : 'runner';
        var en = E.createEnemy(type, edge, ey);
        if (en) st.enemies.push(en);
      }
    }
    // Vitória: boss derrotado
    if (st.boss && !st.boss.alive) {
      st.score += C.scoring.bossKill || 2000;
      missions.succeed(st);
    }
  }

  function updateFinalBoss(st, dt, player) {
    var d = st.data;
    // Spawn final boss
    if (!st.boss && d.boss) {
      var boss = E.createEnemy(d.boss, d.bossX || 1000, d.bossY || 750, 1, 'boss');
      if (boss) {
        st.boss = boss;
        st.enemies.push(boss);
        P.explosion(boss.x, boss.y, COLORS.overdrive, 64, 420);
        SFX.warning();
        missions.pushEvent(st, 'ALERTA MÁXIMA: NULL TITAN', 'bad');
      }
    }
    // Spawn de ondas de reforço durante a luta do chefão final
    if (st.boss) {
      st.bossWaveTimer = (st.bossWaveTimer || 0) - dt;
      if (st.bossWaveTimer <= 0 && st.enemies.length < (C.difficulty.maxActiveEnemies || 14)) {
        st.bossWaveTimer = 12 + Math.random() * 8; // 12-20s
        var w = st.world ? st.world.width : 2000;
        var h = st.world ? st.world.height : 1500;
        // Spawn 3-4 inimigos variados
        for (var i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
          var edge = Math.random() < 0.5 ? 0 : w;
          var ey = Math.random() * h;
          var r = Math.random();
          var type = r < 0.4 ? 'drone' : (r < 0.7 ? 'runner' : 'shooter');
          var en = E.createEnemy(type, edge, ey);
          if (en) st.enemies.push(en);
        }
        missions.pushEvent(st, 'REFORÇOS CHEGANDO', 'bad');
      }
    }
    // Vitória: boss final derrotado
    if (st.boss && !st.boss.alive) {
      st.score += C.scoring.bossKill || 3000;
      missions.succeed(st);
    }
  }

  function updateObjective(st, dt, player) {
    var d = st.data;
    // Spawn inimigos se declarados
    if (st.enemies.length === 0 && !st.initialSpawned) {
      st.initialSpawned = true;
      (d.enemies || []).forEach(function (e) {
        var en = E.createEnemy(e.type, e.x, e.y);
        if (en) st.enemies.push(en);
      });
    }
    // Objetivo customizado: se houver exit, chegar lá
    if (d.exit) {
      if (U.dist(player.x, player.y, d.exit.x, d.exit.y) < d.exit.radius + player.radius + 10) {
        st.score += C.scoring.objective;
        missions.succeed(st);
      }
    } else if (st.enemies.length === 0 && st.initialSpawned) {
      // Sem exit: derrotar todos
      st.score += C.scoring.objective;
      missions.succeed(st);
    }
  }

  missions.fail = function (st, reason) {
    if (st.state !== STATE.ACTIVE) return;
    st.state = STATE.FAILURE;
    st.failReason = reason || 'MISSÃO FALHOU';
    st.prompt = null;
    SFX.defeat();
  };

  MC.missions = missions;

})(window);