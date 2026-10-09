/* ============================================
   MECH//CADET — Sistema de XP (V2)
   Inimigo desativado deixa XP no chão.
   Coletar exige movimento — é a segunda razão
   para circular pela arena.
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;
  var COLORS = MC.COLORS;
  var U = MC.utils;
  var P = MC.particles;
  var SFX = MC.audio.SFX;

  var xp = {
    /** XP base por tipo de inimigo. */
    valueFor: function (enemyType) {
      switch (enemyType) {
        case 'drone': return 8;
        case 'interceptor': return 11;
        case 'sentinel': return 16;
        case 'runner': return 12;
        case 'shooter': return 18;
        case 'tank': return 30;
        case 'splitter': return 20;
        case 'hunter': return 24;
        case 'elite': return 45;
        default: return 10;
      }
    },

    /** XP necessário para sair do nível `level`. */
    neededFor: function (level) {
      var cfg = C.xp;
      if (level >= cfg.maxLevel) return Infinity;
      return Math.round(cfg.curveBase * Math.pow(cfg.curveExp, level - 1));
    },

    /** Cria orbes no ponto da morte do inimigo. */
    drop: function (ms, x, y, amount) {
      if (!ms.xpOrbs) ms.xpOrbs = [];
      if (!ms.world) return;

      // Respiro: nunca nasce dentro de obstáculo
      if (U.isInsideAnyRect(x, y, ms.world.obstacles, 0)) {
        var a = Math.random() * Math.PI * 2;
        x = U.clamp(x + Math.cos(a) * 46, 40, ms.world.width - 40);
        y = U.clamp(y + Math.sin(a) * 46, 40, ms.world.height - 40);
        if (U.isInsideAnyRect(x, y, ms.world.obstacles, 0)) return;
      }

      var pool = MC.pools.getXP();
      var orb = pool.get();
      orb.x = x; orb.y = y;
      orb.amount = amount;
      orb.life = C.xp.orbLife;
      orb.phase = Math.random() * Math.PI * 2;
      orb.magnet = false;
      orb.alive = true;

      var a2 = Math.random() * Math.PI * 2;
      var spread = 40 + Math.random() * 70;
      orb.vx = Math.cos(a2) * spread;
      orb.vy = Math.sin(a2) * spread;

      ms.xpOrbs.push(orb);
      P.pickup(x, y, COLORS.cyan);
    },

    /** Raio de atração atual (sobe com o upgrade Coletor de XP). */
    magnetRadius: function (player) {
      var stacks = (player.mods && player.mods.magnetStacks) || 0;
      return C.xp.magnetRadius + stacks * C.xp.magnetRadiusPerStack;
    },

    /**
     * Atualiza orbes. Retorna a quantidade de XP coletada
     * neste frame (para o level up checar).
     */
    update: function (ms, dt, player) {
      if (!ms.xpOrbs || !player.alive) return 0;

      var list = ms.xpOrbs;
      var magnetR = xp.magnetRadius(player);
      var magnetR2 = magnetR * magnetR;
      var forced = !!(player.buffs && player.buffs.magnet > 0);
      var collected = 0;

      for (var i = list.length - 1; i >= 0; i--) {
        var o = list[i];
        o.life -= dt;
        o.phase += dt * 4;

        if (o.life <= 0) {
          list.splice(i, 1);
          MC.pools.getXP().release(o);
          continue;
        }

        var dx = player.x - o.x;
        var dy = player.y - o.y;
        var d2 = dx * dx + dy * dy;

        if (forced || d2 < magnetR2) o.magnet = true;

        if (o.magnet) {
          var d = Math.sqrt(d2) || 1;
          var pull = C.xp.magnetPull * dt;
          o.x += (dx / d) * pull;
          o.y += (dy / d) * pull;
          o.vx = 0; o.vy = 0;
        } else if (o.vx || o.vy) {
          o.x += o.vx * dt;
          o.y += o.vy * dt;
          o.vx *= 0.9;
          o.vy *= 0.9;
        }

        // Coleta
        var pr = player.radius + o.radius;
        if (dx * dx + dy * dy < pr * pr) {
          // Só soma e devolve: quem credita no `player.xp` é `add`,
          // para o level up não ter dois donos.
          collected += o.amount;
          player.xpOrbsCollected++;
          P.pickup(o.x, o.y, COLORS.cyan);
          list.splice(i, 1);
          MC.pools.getXP().release(o);
        }
      }

      return collected;
    },

    /**
     * Adiciona XP e devolve quantos níveis subiram.
     * Único ponto do jogo onde `player.xp` muda — o level up em si é
     * tratado por MC.game.
     */
    add: function (player, amount) {
      if (amount <= 0) return 0;
      player.xp += amount;
      return xp.checkLevel(player);
    },

    /** Promove enquanto houver XP para a próxima barra. */
    checkLevel: function (player) {
      var levels = 0;
      while (player.level < C.xp.maxLevel) {
        var need = xp.neededFor(player.level);
        if (player.xp < need) break;
        player.xp -= need;
        player.level++;
        levels++;
      }
      if (player.level >= C.xp.maxLevel) player.xp = 0;
      return levels;
    },

    /** Progresso 0..1 da barra atual. */
    progress: function (player) {
      var need = xp.neededFor(player.level);
      if (!isFinite(need)) return 1;
      return U.clamp(player.xp / need, 0, 1);
    },

    clear: function (ms) {
      if (!ms || !ms.xpOrbs) return;
      var pool = MC.pools.getXP();
      for (var i = 0; i < ms.xpOrbs.length; i++) pool.release(ms.xpOrbs[i]);
      ms.xpOrbs.length = 0;
    },
  };

  MC.xp = xp;

})(window);
