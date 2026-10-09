/* ============================================
   MECH//CADET — Power-ups temporários (V2)
   Drops "semi-inteligentes": o jogo percebe o que
   a criança precisa sem nunca dizer isso.
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;
  var COLORS = MC.COLORS;
  var P = MC.particles;
  var SFX = MC.audio.SFX;

  // tipo -> {label, color, desc}
  var TYPES = {
    overcharge: { label: 'OVERCHARGE', color: COLORS.overdrive, desc: 'tiro mais rápido' },
    magnet:     { label: 'ÍMÃ',        color: COLORS.cyan,      desc: 'XP vem até você' },
    shield:     { label: 'ESCUDO +',   color: COLORS.success,   desc: 'escudo cheio' },
    rapidLaser: { label: 'LASER RÁPIDO', color: '#c07bff',      desc: 'laser recarrega rápido' },
    rush:       { label: 'TURBO',      color: COLORS.warning,   desc: 'mais velocidade' },
    timeFreeze: { label: 'TEMPO LENTO', color: '#5ad2ff',       desc: 'inimigos mais lentos' },
    energy:     { label: 'ENERGIA',    color: COLORS.warning,   desc: 'energia restaurada' },
  };

  var powerups = {
    TYPES: TYPES,

    /**
     * Decide qual power-up soltar, pesando o que o jogador precisa.
     * A lógica é invisível para quem joga — é só "sorte", do ponto
     * de vista da criança.
     */
    choose: function (ms, player) {
      var weights = {};
      var w, i;
      var keys = Object.keys(C.powerups.weights);

      for (i = 0; i < keys.length; i++) weights[keys[i]] = C.powerups.weights[keys[i]];

      // shield herda o bonus da Station? não: olha o escudo do jogador
      var shieldPct = player.maxShield ? player.shield / player.maxShield : 1;
      if (shieldPct < 0.35) {
        weights.shield *= 4.0;
        weights.rush *= 0.4;      // fugir também ajuda
      } else if (shieldPct > 0.85) {
        weights.shield *= 0.3;
      }

      if (player.energy < player.maxEnergy * 0.3) {
        weights.energy *= 4.0;
      }

      // Se o laser está longe de carregar, é útil guardar um rapidLaser
      if (player.laserUnlocked && player.laserCooldown > 3.5) {
        weights.rapidLaser *= 3.0;
      } else if (!player.laserUnlocked) {
        weights.rapidLaser = 0;
      }

      // Se o jogador está forte, dá menos "socorro"
      if (player.level >= 8) {
        weights.shield *= 0.6;
        weights.timeFreeze *= 1.4;
      }

      var total = 0;
      for (i = 0; i < keys.length; i++) total += weights[keys[i]];
      if (total <= 0) return 'shield';

      var roll = Math.random() * total;
      for (i = 0; i < keys.length; i++) {
        roll -= weights[keys[i]];
        if (roll <= 0) return keys[i];
      }
      return 'shield';
    },

    /** Solta um power-up no chão. */
    drop: function (ms, x, y, type) {
      if (!ms.powerDrops) ms.powerDrops = [];
      if (ms.powerDrops.length >= C.powerups.maxActive * 3) return;

      type = type || powerups.choose(ms, ms.playerRef);

      var pool = MC.pools.getPowerUps();
      var o = pool.get();
      o.type = type;
      o.x = x; o.y = y;
      o.life = 18;
      o.phase = Math.random() * Math.PI * 2;
      o.alive = true;
      ms.powerDrops.push(o);

      P.ring(x, y, TYPES[type].color, 22);
      return o;
    },

    /** Aplica o efeito (imediatos ou temporários). */
    apply: function (player, type) {
      var info = TYPES[type];
      if (!info) return;

      P.explosion(player.x, player.y, info.color, 18, 200);
      P.ring(player.x, player.y, info.color, 30);
      SFX.powerUp();

      if (type === 'energy') {
        player.energy = player.maxEnergy;
        return;
      }

      if (type === 'shield') {
        player.shield = player.maxShield;
        player.invulnerable = Math.max(player.invulnerable, 1.5);
        player.shieldRegenTimer = 0;
      }

      var d = C.powerups.durations[type] || 8;
      player.buffs[type] = Math.max(player.buffs[type] || 0, d);
    },

    /** Atualiza timers e remove expirados. */
    update: function (ms, dt, player) {
      var list = ms.powerDrops;
      if (!list) return;

      for (var i = list.length - 1; i >= 0; i--) {
        var o = list[i];
        o.life -= dt;
        o.phase += dt * 3;

        if (o.life <= 0) {
          list.splice(i, 1);
          MC.pools.getPowerUps().release(o);
          continue;
        }

        var d = U_dist(player.x, player.y, o.x, o.y);
        if (d < player.radius + o.radius + 6) {
          powerups.apply(player, o.type);
          list.splice(i, 1);
          MC.pools.getPowerUps().release(o);
        }
      }
    },

    /** Buffs ativos (para o HUD). */
    active: function (player) {
      var out = [];
      for (var k in player.buffs) {
        if (player.buffs[k] > 0) out.push({ type: k, time: player.buffs[k], info: TYPES[k] });
      }
      return out;
    },

    /** Multiplicador de velocidade atual. */
    speedMul: function (player) {
      return player.buffs.rush > 0 ? 1.5 : 1;
    },

    /** Multiplicador da recarga do tiro básico. */
    fireRateMul: function (player) {
      var m = 1;
      if (player.buffs.overcharge > 0) m *= 0.55;
      if (player.mods && player.mods.overdriveMaster && player.overdriveActive) m *= 0.5;
      return m;
    },

    /** Multiplicador do cooldown do laser. */
    laserCooldownMul: function (player) {
      var m = (player.mods && player.mods.laserCooldownMul) || 1;
      if (player.buffs.rapidLaser > 0) m *= 0.5;
      return m;
    },

    clear: function (ms) {
      if (!ms || !ms.powerDrops) return;
      var pool = MC.pools.getPowerUps();
      for (var i = 0; i < ms.powerDrops.length; i++) pool.release(ms.powerDrops[i]);
      ms.powerDrops.length = 0;
    },
  };

  function U_dist(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  MC.powerups = powerups;

})(window);
