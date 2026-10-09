/* ============================================
   MECH//CADET — Laser Tático (V2)
   Feixe instantâneo e largo. Atravessa todos os
   inimigos alinhados, tem recarga longa e nunca
   deveria derrotar um chefe sozinho.

   A mecânica ensina "função + cooldown" sem uma
   palavra de teoria: a ação existe, mas depende
   de uma regra de tempo.
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;
  var COLORS = MC.COLORS;
  var U = MC.utils;
  var P = MC.particles;
  var SFX = MC.audio.SFX;

  var laser = {
    /** Duração da recarga atual, já com upgrades e power-ups. */
    cooldownOf: function (player) {
      var cfg = C.laser;
      var mods = player.mods || {};
      var mul = (mods.laserCooldownMul || 1) * (mods.cooldownMul || 1);
      if (player.buffs && player.buffs.rapidLaser > 0) mul *= 0.5;
      if (C.difficulty && C.difficulty.laserCooldownMul) mul *= C.difficulty.laserCooldownMul;
      return cfg.cooldown * mul;
    },

    /** O laser já foi liberado pela campanha? */
    isUnlocked: function (player) {
      return !!(player.laserUnlocked || player.mods && player.mods.laserUnlocked);
    },

    /** Pode disparar agora? */
    canFire: function (player) {
      if (!player.alive) return false;
      if (!laser.isUnlocked(player)) return false;
      return player.laserCooldown <= 0;
    },

    /**
     * Dispara o feixe na direção da mira.
     * @returns {boolean} true se o disparo aconteceu
     */
    fire: function (player, ms, aimAngle) {
      if (!laser.canFire(player)) return false;

      var cfg = C.laser;
      var angle = (aimAngle === undefined || aimAngle === null) ? player.angle : aimAngle;

      var x1 = player.x;
      var y1 = player.y;
      var reach = laser.reach(ms, x1, y1, angle, cfg.range);
      var x2 = x1 + Math.cos(angle) * reach;
      var y2 = y1 + Math.sin(angle) * reach;

      // Feixe puramente visual — o dano já foi aplicado abaixo.
      // Overdrive: laser fica laranja
      var beamColor = (player.overdriveActive) ? COLORS.overdrive : COLORS.cyan;
      ms.lasers.push({
        x1: x1, y1: y1, x2: x2, y2: y2,
        width: cfg.width,
        life: cfg.beamLife,
        maxLife: cfg.beamLife,
        color: beamColor,
      });

      var cdMul = (C.difficulty && C.difficulty.laserCooldownMul) || 1;
      player.laserCooldown = laser.cooldownOf(player); // cooldownOf já considera modifiers, vamos ajustar?

      laser.hitScan(ms, x1, y1, x2, y2, cfg);
      MC.renderer.shake(7);

      SFX.laser();
      return true;
    },

    /** Distância real do feixe, interrompida por obstáculos. */
    reach: function (ms, x, y, angle, range) {
      var world = ms.world;
      if (!world) return range;

      var step = 14;
      for (var d = step; d <= range; d += step) {
        var px = x + Math.cos(angle) * d;
        var py = y + Math.sin(angle) * d;
        if (U.isInsideAnyRect(px, py, world.obstacles, 0)) return d - step;
      }
      return range;
    },

    /** Aplica dano em todos os inimigos cruzados pelo segmento. */
    hitScan: function (ms, x1, y1, x2, y2, cfg) {
      var list = ms.enemies;
      var half = cfg.width * 0.5;
      var mods = (ms.playerRef && ms.playerRef.mods) || {};
      var damage = cfg.damage * (mods.damageMul || 1);
      var hits = 0;

      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e.alive) continue;

        var d = U.distToSegment(e.x, e.y, x1, y1, x2, y2);
        if (d > half + e.radius) continue;

        // Alvo múltiplo: chefes recebem uma fração por feixe, o que
        // garante a regra do documento ("não derrota o chefe sozinho").
        var mult = (e.tier === 'boss') ? 0.25 : (e.tier === 'mini' ? 0.6 : 1);
        var dealt = damage * mult;

        // damageEnemy centraliza XP/pontos/filhotes e só entrega o
        // "splash" uma vez, então dá para chamar em laço sem medo.
        MC.entities.damageEnemy(e, dealt, ms);
        hits++;

        if (e.alive) {
          var p = ms.playerRef;
          if (p) p.damageDealt = (p.damageDealt || 0) + dealt;
        }
        if (cfg.stun) e.stunTimer = Math.max(e.stunTimer || 0, cfg.stun);
        P.sparks(e.x, e.y, COLORS.cyan, 6);
      }

      return hits;
    },

    /** Atualiza recarga do jogador e vida dos feixes. */
    update: function (ms, dt, player) {
      if (player.laserCooldown > 0) {
        player.laserCooldown = Math.max(0, player.laserCooldown - dt);
      }

      var list = ms.lasers;
      if (!list || !list.length) return;

      for (var i = list.length - 1; i >= 0; i--) {
        var b = list[i];
        b.life -= dt;
        if (b.life <= 0) list.splice(i, 1);
      }
    },

    /** Progresso 0..1 da recarga (1 = pronto). */
    readiness: function (player) {
      if (!laser.isUnlocked(player)) return 0;
      var total = laser.cooldownOf(player);
      if (total <= 0) return 1;
      return U.clamp(1 - player.laserCooldown / total, 0, 1);
    },

    /** Desbloqueia (usado pela progressão da campanha). */
    unlock: function (player) {
      player.laserUnlocked = true;
      player.laserCooldown = 0;
    },

    clear: function (ms) {
      if (ms && ms.lasers) ms.lasers.length = 0;
    },
  };

  MC.laser = laser;

})(window);