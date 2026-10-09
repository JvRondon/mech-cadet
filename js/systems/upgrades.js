/* ============================================
   MECH//CADET — Upgrades (V2)
   As 10 melhorias oferecidas no level up.
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});

  /**
   * Cada upgrade tem:
   *   id, nome, desc, raridade, maxStacks, cor e apply(player)
   * `apply` só mexe em player.mods — quem recalcula os statsderivative
   * chama MC.upgrades.recalc(player).
   */
  var LIST = [
    {
      id: 'energyCore', name: 'NÚCLEO ENERGÉTICO', icon: '⚡',
      desc: '+20% de energia máxima', rarity: 'common', maxStacks: 4,
      apply: function (m) { m.energyMul *= 1.2; },
    },
    {
      id: 'armor', name: 'BLINDAGEM', icon: '🛡',
      desc: '+15% de escudo máximo', rarity: 'common', maxStacks: 4,
      apply: function (m) { m.shieldMul *= 1.15; },
    },
    {
      id: 'motors', name: 'MOTORES', icon: '⚙',
      desc: '+10% de velocidade', rarity: 'common', maxStacks: 4,
      apply: function (m) { m.speedMul *= 1.1; },
    },
    {
      id: 'capacitor', name: 'CONDENSADOR', icon: '⏱',
      desc: '−15% de recarga de todas as habilidades', rarity: 'uncommon', maxStacks: 3,
      apply: function (m) { m.cooldownMul *= 0.85; },
    },
    {
      id: 'amplifiedPulse', name: 'PULSO AMPLIFICADO', icon: '◉',
      desc: '+20% de dano do tiro básico', rarity: 'uncommon', maxStacks: 4,
      apply: function (m) { m.damageMul *= 1.2; },
    },
    {
      id: 'laserMod', name: 'LASER TÁTICO+', icon: '⚡',
      desc: '−20% de recarga do laser', rarity: 'uncommon', maxStacks: 3,
      apply: function (m) { m.laserCooldownMul *= 0.8; },
    },
    {
      id: 'overdrive', name: 'OVERDRIVE+', icon: '★',
      desc: '+1 s de duração do Overdrive', rarity: 'uncommon', maxStacks: 3,
      apply: function (m) { m.overdriveBonus += 1; },
    },
    {
      id: 'collector', name: 'COLETOR DE XP', icon: '◎',
      desc: 'Atrai o XP de muito mais longe', rarity: 'rare', maxStacks: 3,
      apply: function (m) { m.magnetStacks++; },
    },
    {
      id: 'regen', name: 'REGENERAÇÃO', icon: '✚',
      desc: 'Regenera escudo mais rápido', rarity: 'rare', maxStacks: 3,
      apply: function (m) { m.regenBonus += 6; },
    },
    {
      id: 'coreShield', name: 'CAMPO DE FASE', icon: '◆',
      desc: 'Reduz o dano recebido em 15%', rarity: 'rare', maxStacks: 2,
      apply: function (m) { m.damageReduction += 0.15; },
    },
    {
      id: 'overdriveMaster', name: 'OVERDRIVE MESTRE', icon: '✹',
      desc: 'Overdrive também acelera o tiro', rarity: 'epic', maxStacks: 1,
      apply: function (m) { m.overdriveMaster = true; },
    },
    {
      id: 'novaPulse', name: 'PULSO NOVA', icon: '✺',
      desc: 'O tiro explode numa pequena área', rarity: 'epic', maxStacks: 1,
      apply: function (m) { m.novaPulse = true; },
    },
  ];

  var RARITY_CHANCE = {
    common: 55, uncommon: 30, rare: 12, epic: 3,
  };

  var RARITY_COLOR = {
    common: '#8ab4d4',
    uncommon: '#00d9ff',
    rare: '#c07bff',
    epic: '#ffaa00',
  };

  /** Modificadores neutros de um jogador novo. */
  function baseMods() {
    return {
      speedMul: 1,
      shieldMul: 1,
      energyMul: 1,
      cooldownMul: 1,
      damageMul: 1,
      laserCooldownMul: 1,
      regenBonus: 0,
      overdriveBonus: 0,
      damageReduction: 0,
      magnetStacks: 0,
      overdriveMaster: false,
      novaPulse: false,
    };
  }

  var upgrades = {
    LIST: LIST,

    baseMods: baseMods,

    /** Prepara player.mods e registra os upgrades adquiridos. */
    init: function (player) {
      player.upgrades = {};
      player.mods = baseMods();
    },

    /** Recalcula os stats derivados a partir dos mods. */
    recalc: function (player) {
      var C = MC.CONFIG;
      var m = player.mods;

      player.speed = C.player.speed * m.speedMul;
      player.maxShield = C.player.maxShield * m.shieldMul;
      player.maxEnergy = C.player.maxEnergy * m.energyMul;
      player.maxOverdrive = C.player.overdriveMax;
      player.overdriveDuration = C.player.overdriveDuration + m.overdriveBonus;

      // O escudo/energia não pode ENCOLHER ao trocar de build
      player.shield = Math.min(player.shield, player.maxShield);
      player.energy = Math.min(player.energy, player.maxEnergy);
    },

    /** Aplica um upgrade (chamado ao escolher na tela de level up). */
    apply: function (player, id) {
      var def = null;
      for (var i = 0; i < LIST.length; i++) {
        if (LIST[i].id === id) { def = LIST[i]; break; }
      }
      if (!def) return false;

      var stacks = player.upgrades[id] || 0;
      if (stacks >= def.maxStacks) return false;

      player.upgrades[id] = stacks + 1;
      def.apply(player.mods);
      upgrades.recalc(player);
      return true;
    },

    /**
     * Sorteia `count` opções DISTINTAS para a tela de escolha.
     * Evita oferecer três opções equivalentes (mesma categoria).
     */
    roll: function (player, count) {
      count = count || 3;

      var pool = [];
      for (var i = 0; i < LIST.length; i++) {
        var u = LIST[i];
        var taken = (player.upgrades[u.id] || 0);
        if (taken >= u.maxStacks) continue;
        // Upgrade já repetido vale menos na hora de oferecer: a novelty
        // está em algo que a criança ainda não viu.
        pool.push({ def: u, w: RARITY_CHANCE[u.rarity] / (1 + taken * 0.6) });
      }

      var picked = [];
      var usedCategories = {};
      var guard = 0;

      while (picked.length < count && pool.length && guard++ < 200) {
        var total = 0, i2;
        for (i2 = 0; i2 < pool.length; i2++) total += pool[i2].w;
        var roll = Math.random() * total;
        var idx = pool.length - 1;
        for (i2 = 0; i2 < pool.length; i2++) {
          roll -= pool[i2].w;
          if (roll <= 0) { idx = i2; break; }
        }

        var cand = pool[idx];
        var cat = categoryOf(cand.def);

        // Se já temos 2+ da mesma categoria, pula
        var sameCat = picked.filter(function (x) { return categoryOf(x.def) === cat; }).length;
        if (sameCat >= 2 && pool.length > 1) {
          pool.splice(idx, 1);
          continue;
        }

        picked.push(cand);
        pool.splice(idx, 1);
      }

      // Se sobrou pouco (quase tudo no max), completa com o que sobrou
      while (picked.length < count) {
        var rest = LIST.filter(function (u) {
          var t = player.upgrades[u.id] || 0;
          return t < u.maxStacks;
        });
        if (!rest.length) break;
        picked.push({ def: rest[Math.floor(Math.random() * rest.length)], w: 1 });
      }

      return picked.map(function (x) {
        var d = x.def;
        return {
          id: d.id,
          name: d.name,
          icon: d.icon,
          desc: d.desc,
          rarity: d.rarity,
          color: upgrades.color(d.rarity),
          stacks: player.upgrades[d.id] || 0,
          maxStacks: d.maxStacks,
        };
      });
    },

    color: function (rarity) { return RARITY_COLOR[rarity] || RARITY_COLOR.common; },
  };

  function categoryOf(def) {
    // Agrupa por efeito principal para evitar 3 opções iguais
    switch (def.id) {
      case 'energyCore': return 'energia';
      case 'armor': case 'coreShield': case 'regen': return 'defesa';
      case 'motors': return 'movimento';
      case 'capacitor': case 'laserMod': return 'cooldown';
      case 'amplifiedPulse': case 'novaPulse': return 'dano';
      case 'overdrive': case 'overdriveMaster': return 'overdrive';
      case 'collector': return 'xp';
      default: return def.id;
    }
  }

  upgrades.categoryOf = categoryOf;

  MC.upgrades = upgrades;

})(window);
