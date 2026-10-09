/* ============================================
   MECH//CADET — Spawner / Enemy Director (V2)
   Densidade ~3x com object pooling.

   Duas responsabilidades:
     1. RECICLAR inimigos (nada de `new` no loop).
     2. DECIDIR quando e o que entra na arena.

   A composição de grupo segue a regra do documento:
   perseguidor + ameaça à distância + unidade rápida.
   Sem os três, o jogador não precisa decidir nada.
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;
  var COLORS = MC.COLORS;
  var U = MC.utils;
  var P = MC.particles;
  var SFX = MC.audio.SFX;

  // ==========================================
  // POOL DE INIMIGOS
  // ==========================================

  var enemyPool = null;

  function getPool() {
    if (enemyPool) return enemyPool;
    enemyPool = new MC.Pool(
      function () { return MC.entities.createEnemy('drone', 0, 0); },
      function (e) { e.alive = false; }
    );
    return enemyPool;
  }

  function release(e) {
    getPool().release(e);
  }

  // ==========================================
  // COMPOSIÇÃO
  // ==========================================

  // Papéis. Um grupo justo tem (pelo menos) um de cada.
  var ROLES = {
    pursue: ['drone', 'tank'],
    ranged: ['shooter', 'sentinel'],
    fast:   ['runner', 'interceptor'],
  };

  var ALL_TYPES = ['drone', 'runner', 'shooter', 'tank', 'splitter', 'hunter', 'elite'];

  /**
   * Sorteia uma composição de `count` inimigos em torno de `origin`,
   * respeitando a regra dos três papéis.
   */
  function composeGroup(count, allowed) {
    var out = [];
    var bag = allowed || ALL_TYPES;

    // 1) garante um perseguidor
    out.push(U.pick(pickFrom(bag, ROLES.pursue) || bag));

    // 2) alterna ameaça à distância e unidade rápida
    for (var i = 1; i < count; i++) {
      var role = (i % 2 === 1) ? ROLES.ranged : ROLES.fast;
      out.push(U.pick(pickFrom(bag, role) || bag));
    }

    // 3) preenche o resto com qualquer coisa permitida
    while (out.length < count) out.push(U.pick(bag));

    // O Elite nunca aparece em grupo: é raro e assusta.
    if (bag.indexOf('elite') >= 0) out = out.filter(function (t) { return t !== 'elite'; });

    return out;
  }

  function pickFrom(bag, roleList) {
    var hits = bag.filter(function (t) { return roleList.indexOf(t) >= 0; });
    return hits.length ? hits : null;
  }

  // ==========================================
  // SPAWNER
  // ==========================================

  var spawner = {
    ROLES: ROLES,
    ALL_TYPES: ALL_TYPES,

    composeGroup: composeGroup,

    /**
     * Quantos inimigos ainda cabem na arena.
     * Todo caminho de spawn passa por aqui — é o teto que segura a
     * performance e mantém a tela legível para a criança.
     */
    room: function (ms) {
      return Math.max(0, C.difficulty.maxActiveEnemies - (ms.enemies ? ms.enemies.length : 0));
    },

    /**
     * Coloca um inimigo na arena reaproveitando um objeto do pool.
     * @param opts { type, tier, speedBoost, scale, silent, ignoreCap }
     */
    spawn: function (ms, type, x, y, opts) {
      if (!ms) return null;
      opts = opts || {};
      var cfg = C.enemies[type];
      if (!cfg) return null;

      // Teto de arena. `ignoreCap` existe para o chefe, que nunca
      // deve ser descartado por limite de feltro.
      if (!opts.ignoreCap && spawner.room(ms) <= 0) return null;

      var pool = getPool();
      var e = pool.get();
      e.tier = opts.tier || 'normal';
      MC.entities.resetEnemy(e, type, opts.speedBoost, opts.scale);
      e.x = x; e.y = y;
      e.spawnAnim = 0.4;

      ms.enemies.push(e);

      if (!opts.silent) {
        P.ring(x, y, COLORS.danger, e.radius + 14);
        SFX.enemySpawn();
      }
      return e;
    },

    /**
     * Solta um grupo ao redor de um ponto.
     * @param opts { count, originX, originY, radius, minPlayerDist, allowed, tier, silent }
     */
    spawnGroup: function (ms, opts) {
      if (!ms || !ms.world) return 0;
      opts = opts || {};

      var count = Math.min(opts.count || 3, spawner.room(ms));
      if (count <= 0) return 0;

      var ox = opts.originX;
      var oy = opts.originY;

      if (ox === undefined || oy === undefined) {
        var p = ms.playerRef;
        ox = p ? p.x : ms.world.width / 2;
        oy = p ? p.y : ms.world.height / 2;
      }

      var radius = opts.radius || 300;
      var minD = opts.minPlayerDist === undefined ? 220 : opts.minPlayerDist;

      var types = composeGroup(count, opts.allowed);
      var made = 0;

      for (var i = 0; i < types.length; i++) {
        var spot = findSpawnSpot(ms, ox, oy, radius, minD);
        if (!spot) continue;

        var e = spawner.spawn(ms, types[i], spot.x, spot.y, {
          tier: opts.tier,
          speedBoost: opts.speedBoost,
          scale: opts.scale,
        });
        if (e) made++;
      }
      return made;
    },

    /**
     * Tudo que acontece quando um inimigo cai.
     * Ponto único de verdade: pontos, XP, power-up, células e filhotes.
     */
    onEnemyDown: function (ms, e) {
      if (!ms) return;

      var p = ms.playerRef;
      if (p) p.kills = (p.kills || 0) + 1;

      // Pontuação
      ms.score = (ms.score || 0) + (e.scoreValue || 0);
      if (MC.ui && MC.ui.setScore) MC.ui.setScore(ms.score);

      // XP no chão (a razão extra para circular pela arena)
      if (!e.isMinion && !e.noXp) {
        MC.xp.drop(ms, e.x, e.y, e.xpValue || 10);
      }

      // Power-up ocasional, escolhido pelo que o jogador precisa
      if (!e.isMinion && Math.random() < C.powerups.dropChance) {
        MC.powerups.drop(ms, e.x, e.y, MC.powerups.choose(ms, p));
      }

      // Célula de energia (o coletável da V1, mantido)
      if (!e.noCell && Math.random() < 0.55 && MC.missions && MC.missions.dropCell) {
        MC.missions.dropCell(ms, e.x, e.y);
      }

      // Splitter: dois menores. É o conceito de CICLO virando mecânica.
      if (e.splits > 0 && spawner.room(ms) > 0) {
        for (var i = 0; i < e.splits; i++) {
          var a = (Math.PI * 2 * i) / e.splits + Math.random();
          spawner.spawn(ms, e.type, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, {
            tier: 'normal',
            scale: 0.5,
            silent: true,
          });
          var last = ms.enemies[ms.enemies.length - 1];
          if (last) { last.isMinion = true; last.noXp = true; last.splits = 0; }
        }
      }

      // Recolhe o objeto para o pool assim que o frame fechar.
    },

    /**
     * Limpa inimigos mortos. Roda uma vez por frame, depois da lógica.
     * `alive === false` é a única condição: todo caminho de dano passa
     * por entities.damageEnemy, então não há como "vazar" um inimigo.
     */
    sweep: function (ms) {
      var list = ms.enemies;
      if (!list) return;
      for (var i = list.length - 1; i >= 0; i--) {
        var e = list[i];
        if (e.alive) continue;
        list.splice(i, 1);
        release(e);
      }
    },

    /** Quanto de pressão a fase pede neste momento. 1 = normal, 3 = 3x. */
    pressureAt: function (missionData, elapsed, total) {
      var cfg = C.difficulty;
      if (missionData && missionData.density) return missionData.density;

      if (!total) return 1;
      // Sobe de 1x para o alvo ao longo da fase; nunca volta atrás.
      var t = U.clamp(elapsed / total, 0, 1);
      return 1 + (cfg.enemyMultiplier - 1) * t;
    },

    /**
     * Enemy Director — o agendador de ondas.
     *
     * O Activity Director cuida de quando a criança PAROU.
     * Este cuida de quando ela está jogando bem: aí a pressão sobe.
     *
     * Regras:
     *   - a pressão cresce de 1x até `enemyMultiplier` ao longo da fase;
     *   - cada onda compõe segundo a regra dos três papéis;
     *   - a chance de Elite cresce com a pressão, nunca no primeiro minuto;
     *   - ninguém nasce em cima do jogador.
     */
    director: {
      timer: 0,
      waveIndex: 0,
      eliteBias: 0,

      reset: function () {
        this.timer = 1.5;          // respiro no começo da fase
        this.waveIndex = 0;
        this.eliteBias = 0;
      },

      /**
       * @param ms    estado da missão
       * @param dt    segundos do frame
       * @param anchor {x, y} centro da onda (o objetivo, não o jogador)
       */
      update: function (ms, dt, anchor) {
        if (ms.state !== MC.missions.STATE.ACTIVE) return;
        if (ms.boss) return;                      // chefe no palco: sem onda

        this.timer -= dt;
        if (this.timer > 0) return;

        var d = C.difficulty;
        var elapsed = ms.elapsed || 0;
        var total = ms.data.timeLimit || 0;
        var pressure = spawner.pressureAt(ms.data, elapsed, total);

        // Intervalo encurta conforme a pressão sobe: 4,4s -> 1,6s
        var interval = U.clamp(
          d.spawnInterval / pressure,
          1.6,
          d.spawnInterval
        );
        this.timer = interval * U.randomRange(0.85, 1.15);

        var room = spawner.room(ms);
        if (room <= 0) return;                    // arena cheia: não força

        // Tamanho da onda cresce, mas sempre sobra folga.
        var count = Math.min(
          room,
          2 + Math.round(pressure) + (this.waveIndex > 3 ? 1 : 0)
        );

        // Elite fica provvel só depois do primeiro terço da fase.
        this.eliteBias = elapsed > total * 0.3 ? d.eliteChance * pressure : 0;

        spawner.wave(ms, count, anchor, this.eliteBias);
        this.waveIndex++;
      },

      /** Estado para o painel de telemetria. */
      stats: function () {
        return { timer: this.timer, waves: this.waveIndex };
      },
    },

    /**
     * Uma onda completa: escolhe a composição e a solta.
     * @param eliteChance 0 = nunca aparece Elite nesta onda
     */
    wave: function (ms, count, anchor, eliteChance) {
      var allowed = ms.allowedTypes || ['drone'];
      var types = composeGroup(count, allowed);

      // Se a fase já liberou Elite, ele entra sozinho — no máximo um,
      // e nunca junto do resto (raridade precisa ser visível).
      if (eliteChance && allowed.indexOf('elite') >= 0 && Math.random() < eliteChance) {
        types[Math.floor(Math.random() * types.length)] = 'elite';
      }

      var cx = anchor ? anchor.x : ms.playerRef.x;
      var cy = anchor ? anchor.y : ms.playerRef.y;
      var made = 0;

      for (var i = 0; i < types.length; i++) {
        if (spawner.room(ms) <= 0) break;

        // O Elite nasce longe, os outros podem vir de perto.
        var radius = (types[i] === 'elite') ? 460 : 340;
        var minD = (types[i] === 'elite') ? 380 : 200;

        var spot = findSpawnSpot(ms, cx, cy, radius, minD);
        if (!spot) continue;

        var e = spawner.spawn(ms, types[i], spot.x, spot.y);
        if (e) made++;
      }
      return made;
    },

    /** Limpa tudo (troca de fase). */
    clear: function (ms) {
      if (!ms || !ms.enemies) return;
      for (var i = 0; i < ms.enemies.length; i++) release(ms.enemies[i]);
      ms.enemies.length = 0;
    },

    /** Libera os objetos da missão anterior de volta para os pools. */
    dispose: function (ms) {
      if (!ms) return;
      spawner.clear(ms);
      MC.xp.clear(ms);
      MC.powerups.clear(ms);
      MC.laser.clear(ms);
      ms.projectiles.length = 0;
    },

    /** Diagnóstico do pool (tela de performance do evento). */
    stats: function () {
      var s = getPool().stats();
      return {
        free: s.free,
        made: s.made,
        // `made` nunca deve crescer sem parar: é o sinal de vazamento
        // de pool. Em jogo normal, made estabiliza perto do teto.
      };
    },
  };

  /**
   * Acha um ponto válido: longe do jogador o suficiente para não
   * materializar em cima dele, fora de obstáculos e dentro do mapa.
   */
  function findSpawnSpot(ms, ox, oy, radius, minD) {
    var world = ms.world;
    var p = ms.playerRef;

    for (var attempt = 0; attempt < 14; attempt++) {
      var a = Math.random() * Math.PI * 2;
      var r = radius * (0.55 + Math.random() * 0.45);
      var x = U.clamp(ox + Math.cos(a) * r, 60, world.width - 60);
      var y = U.clamp(oy + Math.sin(a) * r, 60, world.height - 60);

      if (U.isInsideAnyRect(x, y, world.obstacles, 26)) continue;
      if (p && minD > 0 && U.dist(x, y, p.x, p.y) < minD) continue;

      return { x: x, y: y };
    }

    // Nenhuma casa boa: pelo menos um ponto dentro do mapa.
    return { x: U.clamp(ox, 60, world.width - 60), y: U.clamp(oy, 60, world.height - 60) };
  }

  MC.spawner = spawner;

})(window);