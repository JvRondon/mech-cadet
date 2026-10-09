/* ============================================
   MECH//CADET — DEFESA ORBITAL
   Configurações Globais
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});

  MC.CONFIG = {
    // ---------- Jogador ----------
    player: {
      radius: 22,
      speed: 210,
      turnLerp: 0.18,

      dashSpeed: 640,
      dashDuration: 0.15,
      dashCooldown: 1.2,

      maxShield: 100,
      maxEnergy: 100,
      shieldRegenDelay: 2.5,
      shieldRegenRate: 18,
      energyRegenRate: 10,
      invulnTime: 0.8,

      overdriveDuration: 4.0,
      overdriveSpeedBonus: 1.35,
      overdriveShieldBonus: 60,
      overdriveMax: 100,
      overdriveRecharge: 0.12, // %/segundo
    },

    // ---------- Combate ----------
    combat: {
      pulseSpeed: 620,
      pulseDamage: 25,
      pulseRadius: 7,
      pulseCooldown: 0.32,
      energyCost: 4,
    },

    // ---------- Inimigos ----------
    enemies: {
      guardian: {
        radius: 42, speed: 55, health: 320,
        damage: 20, attackRange: 400, attackRate: 2.5, score: 500,
      },

      // ---------- V2: os 7 tipos da campanha ----------
      // Composição de grupo (regra do documento):
      //   perseguidor + ameaça à distância + unidade rápida.
      // Assim o jogador precisa decidir posicionamento.

      /** F1 — persegue direto. */
      drone: {
        radius: 14, speed: 85, health: 50,
        damage: 10, attackRange: 380, attackRate: 1.6, score: 75,
        xp: 8, behavior: 'pursue',
      },

      /** F2 — rápido, tenta chegar pelas laterais. */
      runner: {
        radius: 12, speed: 195, health: 36,
        damage: 8, attackRange: 320, attackRate: 1.15, score: 110,
        xp: 12, behavior: 'flank',
      },

      /** F3 — raramente chega perto; ameaça à distância. */
      shooter: {
        radius: 15, speed: 60, health: 55,
        damage: 12, attackRange: 550, attackRate: 2.0, score: 130,
        xp: 18, behavior: 'ranged',
      },

      /** F4 — lento e blindado; fecha a porta para o jogador. */
      tank: {
        radius: 26, speed: 48, health: 185,
        damage: 18, attackRange: 400, attackRate: 2.4, score: 220,
        xp: 30, behavior: 'tank',
      },

      /** F6 — ao cair, gera dois menores. Ensina ciclo. */
      splitter: {
        radius: 22, speed: 100, health: 92,
        damage: 12, attackRange: 380, attackRate: 1.8, score: 180,
        xp: 20, behavior: 'split', splits: 2,
      },

      /** F7 — não persegue o jogador: corta a rota até o objetivo. */
      hunter: {
        radius: 16, speed: 150, health: 72,
        damage: 14, attackRange: 450, attackRate: 1.4, score: 260,
        xp: 24, behavior: 'intercept',
      },

      /** F8 — raro, com habilidade especial. */
      elite: {
        radius: 30, speed: 105, health: 340,
        damage: 22, attackRange: 500, attackRate: 1.8, score: 600,
        xp: 45, behavior: 'elite', specialCooldown: 6.5,
      },

      // ---------- Legado V1 ----------
      // As 4 fases atuais ainda referenciam estes nomes. Mapeados
      // para os comportamentos da V2; some quando a campanha for
      // reescrita (Lote 3).
      sentinel: {
        radius: 19, speed: 0, health: 90,
        damage: 12, attackRange: 500, attackRate: 2.2, score: 100,
        xp: 16, behavior: 'ranged',
      },
      interceptor: {
        radius: 12, speed: 165, health: 30,
        damage: 8, attackRange: 350, attackRate: 1.1, score: 125,
        xp: 11, behavior: 'flank',
      },
      // ----- Bosses 10-Fases (HP x5 = +400%)
      warden: {
        radius: 48, speed: 60, health: 4750,
        damage: 18, attackRange: 420, attackRate: 2.0, score: 1200,
        xp: 120, behavior: 'boss', tier: 'mini'
      },
      warden_boss: {
        radius: 48, speed: 60, health: 4750,
        damage: 18, attackRange: 420, attackRate: 2.0, score: 1200,
        xp: 120, behavior: 'boss', tier: 'mini'
      },
      nullTitan: {
        radius: 68, speed: 70, health: 11000,
        damage: 28, attackRange: 520, attackRate: 1.8, score: 2000,
        xp: 200, behavior: 'boss', tier: 'boss'
      },
    },

    // ---------- Mundo ----------
    world: {
      width: 2000,
      height: 1500,
      gridSize: 80,
      obstacleCount: 14,
      obstacleMinSize: 50,
      obstacleMaxSize: 150,
      minDistanceFromStart: 190,
    },

    // ---------- Partículas ----------
    particles: { max: 600 },

    // ---------- Laser Tático ----------
    laser: {
      unlocked: false,        // liberado pela campanha (Fase 4+)
      cooldown: 7.0,
      damage: 120,
      width: 12,
      range: 520,
      beamLife: 0.18,         // duração do feixe na tela
      stun: 0.3,              // atordoa quem é atingido
    },

    // ---------- XP e progressão ----------
    xp: {
      orbLife: 18,
      maxOrbs: 180,
      magnetRadius: 58,
      magnetRadiusPerStack: 42,  // upgrade "Coletor XP"
      magnetPull: 300,
      curveBase: 26,             // XP necessário no nível 1
      curveExp: 1.42,
      maxLevel: 12,
    },

    // ---------- Power-ups temporários ----------
    powerups: {
      dropChance: 0.12,
      maxActive: 3,
      weights: {
        overcharge: 1.0,   // ataque mais rápido
        magnet: 1.0,       // XP atraído
        shield: 1.2,       // escudo cheio + proteção
        rapidLaser: 0.8,   // cooldown do laser reduzido
        rush: 0.9,         // velocidade
        timeFreeze: 0.6,   // inimigos lentos
        energy: 0.5,       // instantâneo
      },
      durations: {
        overcharge: 10, magnet: 12, shield: 8,
        rapidLaser: 10, rush: 8, timeFreeze: 5,
      },
    },

    // ---------- Dificuldade (densidade) ----------
    difficulty: {
      mode: 'hard', // 'normal' ou 'hard' (padrão: hard como referência)
      profiles: {
        normal: {
          label: 'NORMAL',
          subtitle: 'Treinamento de Cadete',
          desc: 'Ideal para aprender as mecânicas passo a passo.',
          enemyMultiplier: 1.5,
          maxActiveEnemies: 14,
          spawnInterval: 4.2,
          eliteChance: 0.02,
          enemyLifeMul: 0.7,
          enemyDamageMul: 0.7,
          enemySpeedMul: 0.85,
          enemyFireRateMul: 0.85,
          enemyAttackDelayMul: 1.25,
          bossLifeMul: 0.75,
          bossAttackSpeedMul: 0.85,
          bossWindowMul: 1.25,
          xpDropMul: 1.25,
          powerupDropMul: 1.25,
          powerupLifetimeMul: 1.15,
          dashCooldownMul: 0.8,
          laserCooldownMul: 0.8,
          enemyAggressionMul: 0.8,
          healthRegenLowMul: 1.4, // MECH ASSIST
          aimAssist: 0.15,
        },
        hard: {
          label: 'DIFÍCIL',
          subtitle: 'Operação de Combate',
          desc: 'Experiência completa e desafiadora.',
          enemyMultiplier: 3.0,
          maxActiveEnemies: 28,
          spawnInterval: 3.2,
          eliteChance: 0.08,
          enemyLifeMul: 1.0,
          enemyDamageMul: 1.0,
          enemySpeedMul: 1.0,
          enemyFireRateMul: 1.0,
          enemyAttackDelayMul: 1.0,
          bossLifeMul: 1.0,
          bossAttackSpeedMul: 1.0,
          bossWindowMul: 1.0,
          xpDropMul: 1.0,
          powerupDropMul: 1.0,
          powerupLifetimeMul: 1.0,
          dashCooldownMul: 1.0,
          laserCooldownMul: 1.0,
          enemyAggressionMul: 1.0,
          healthRegenLowMul: 1.0,
          aimAssist: 0.0,
        },
      },
      enemyMultiplier: 3.0,
      maxActiveEnemies: 28,
      spawnInterval: 3.2,
      eliteChance: 0.08,
    },

    // Retorna o perfil de dificuldade atual (normal/hard)
    getDifficultyProfile: function (mode) {
      var m = mode || this.difficulty.mode || 'hard';
      var p = this.difficulty.profiles[m];
      if (!p) p = this.difficulty.profiles.hard;
      return p;
    },

    // Aplica multipliers do perfil nos valores do inimigo
    applyEnemyMultipliers: function (base, mode) {
      var prof = this.getDifficultyProfile(mode);
      if (!prof) return base;
      return {
        health: (base.health || 0) * (prof.enemyLifeMul || 1),
        damage: (base.damage || 0) * (prof.enemyDamageMul || 1),
        speed: (base.speed || 0) * (prof.enemySpeedMul || 1),
        attackRate: (base.attackRate || 1) * (prof.enemyFireRateMul || 1),
        specialCooldown: (base.specialCooldown || 6) * (prof.enemyAttackDelayMul || 1),
      };
    },

    // ---------- Activity Director (anti-ociosidade) ----------
    activity: {
      // Não hápunição: o sistema cria estímulo, não castigo.
      steps: [
        { after: 3,  action: 'group', count: 2, radius: 320 },
        { after: 5,  action: 'hint' },
        { after: 8,  action: 'group', count: 3, radius: 300 },
        { after: 12, action: 'surge', count: 5, radius: 420 },
      ],
    },

    // ---------- Pontuação ----------

    scoring: {
      objective: 500,
      coreCapture: 300,
      noShieldLoss: 250,
      challenge: 400,
      cell: 25,
      timeBonusPerSecond: 2,
      enemyKillBonus: 0, // já vem do inimigo
    },

    // ---------- Visual ----------
    visual: {
      showGrid: true,
      cameraLerp: 0.12,
      shakeDecay: 0.88,
      shakeOnDamage: 7,
    },

    // ---------- Áudio ----------
    audio: { master: 0.7, sfx: 0.8, music: 0.25 },

    // ---------- Patentes ----------
    ranks: [
      { min: 0,     name: 'RECRUTA',    message: 'Você encontrou o caminho.' },
      { min: 1000,  name: 'CADETE',     message: 'Sistema operacional aprovado.' },
      { min: 2000,  name: 'PILOTO',     message: 'Seu Mech responde aos seus comandos.' },
      { min: 3500,  name: 'COMANDANTE', message: 'A defesa orbital reconhece seu talento.' },
    ],

    // ---------- Modo Evento ----------
    eventMode: true,
  };

  MC.COLORS = {
    bg: '#050a12',
    grid: 'rgba(0, 217, 255, 0.035)',
    gridMajor: 'rgba(0, 217, 255, 0.075)',
    cyan: '#00d9ff',
    blue: '#147dff',
    danger: '#ff4d5a',
    success: '#00ff88',
    warning: '#ffaa00',
    overdrive: '#ff7a00',
    text: '#e0f0ff',
    textDim: '#8ab4d4',
  };

})(window);