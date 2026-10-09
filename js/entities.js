/* ============================================
   MECH//CADET — Entidades
   Jogador, Inimigos, Projéteis, Coletáveis
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;
  var COLORS = MC.COLORS;
  var U = MC.utils;
  var P = MC.particles;
  var SFX = MC.audio.SFX;

  var entities = {};

  // ==========================================
  // JOGADOR
  // ==========================================

  entities.createPlayer = function (x, y) {
    var cfg = C.player;
    var p = {
      kind: 'player',
      x: x, y: y,
      radius: cfg.radius,
      speed: cfg.speed,
      angle: -Math.PI / 2,
      targetAngle: -Math.PI / 2,

      dashTime: 0,
      dashCooldown: 0,
      dashVX: 0, dashVY: 0,
      dashing: false,

      shield: cfg.maxShield,
      maxShield: cfg.maxShield,
      energy: cfg.maxEnergy,
      maxEnergy: cfg.maxEnergy,
      shieldRegenTimer: 0,

      overdrive: 0,
      maxOverdrive: cfg.overdriveMax,
      overdriveActive: false,
      overdriveTimer: 0,
      overdriveDuration: cfg.overdriveDuration,

      pulseCooldown: 0,
      invulnerable: 0,
      alive: true,

      score: 0,
      kills: 0,
      damageTaken: 0,
      damageDealt: 0,
      cellsCollected: 0,

      // ---- V2: progressao ----
      xp: 0,
      level: 1,
      xpOrbsCollected: 0,
      upgrades: {},
      mods: null,            // preenchido por MC.upgrades.init
      buffs: {},             // power-ups ativos -> segundos restantes
      pendingLevels: 0,      // escolhas de level up na fila

      // ---- V2: laser tatico ----
      laserUnlocked: false,
      laserCooldown: 0,

      exhaustTimer: 0,
      hitFlash: 0,
    };

    var gs = (MC.game && MC.game.state) || (global.MC && global.MC.game && global.MC.game.state);
    if (gs && gs.persistentUpgrades) {
      p.upgrades = gs.persistentUpgrades;
      p.mods = gs.persistentMods || MC.upgrades.baseMods();
      MC.upgrades.recalc(p);
    } else {
      MC.upgrades.init(p);
      MC.upgrades.recalc(p);
    }
    return p;
  };

  /** Multiplicador de velocidade agora (turbo + overdrive + upgrades). */
  entities.playerSpeedMul = function (p) {
    var m = 1;
    if (MC.powerups) m *= MC.powerups.speedMul(p);
    if (p.overdriveActive) m *= C.player.overdriveSpeedBonus;
    return m;
  };

  /**
   * Atualiza o jogador.
   * @param input  MC.input
   * @param cam    {x, y} deslocamento da câmera
   */
  entities.updatePlayer = function (p, dt, input, world, cam) {
    if (!p.alive) return;

    var cfg = C.player;
    var move = input.getMovementVector();
    var mouse = input.getMouse();

    // Mira: converte a posição do mouse (tela) para o mundo
    var aimAngle = Math.atan2(
      mouse.y + cam.y - p.y,
      mouse.x + cam.x - p.x
    );
    p.targetAngle = aimAngle;
    p.angle = U.rotateToward(p.angle, aimAngle, cfg.turnLerp);

    // Dash
    if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);

    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashVX * dt;
      p.y += p.dashVY * dt;
      p.dashing = true;
      P.dashTrail(p.x, p.y, p.angle);

      if (p.dashTime <= 0) p.dashing = false;
    } else {
      p.dashing = false;

      if (move.length > 0) {
        var speed = p.speed * entities.playerSpeedMul(p);
        p.x += move.dx * speed * dt;
        p.y += move.dy * speed * dt;

        p.exhaustTimer -= dt;
        if (p.exhaustTimer <= 0) {
          P.exhaust(p.x, p.y, p.angle);
          p.exhaustTimer = 0.05;
        }
      }
    }

    // Limites do mundo
    p.x = U.clamp(p.x, p.radius, world.width - p.radius);
    p.y = U.clamp(p.y, p.radius, world.height - p.radius);

    // Colisão com obstáculos (2 passadas para evitar travamento em quinas)
    U.resolveCircleRects(p, world.obstacles);
    U.resolveCircleRects(p, world.obstacles);

    // Regeneração de escudo
    var regen = cfg.shieldRegenRate + (p.mods ? p.mods.regenBonus : 0);
    if (p.shieldRegenTimer > 0) {
      p.shieldRegenTimer -= dt;
    } else if (p.shield < p.maxShield) {
      p.shield = Math.min(p.maxShield, p.shield + regen * dt);
    }

    // Energia
    p.energy = Math.min(p.maxEnergy, p.energy + cfg.energyRegenRate * dt);

    // Overdrive
    if (p.overdriveActive) {
      p.overdriveTimer -= dt;
      p.overdrive = Math.max(0, (p.overdriveTimer / p.overdriveDuration) * p.maxOverdrive);
      if (p.overdriveTimer <= 0) {
        p.overdriveActive = false;
        p.overdrive = 0;
      }
    }

    // Power-ups temporários (buffs). Apagados ao zerar para não
    // acumular lixo no objeto.
    for (var b in p.buffs) {
      if (p.buffs[b] > 0) {
        p.buffs[b] = Math.max(0, p.buffs[b] - dt);
        if (p.buffs[b] === 0) delete p.buffs[b];
      }
    }

    // Cooldowns e temporizadores
    if (p.pulseCooldown > 0) p.pulseCooldown = Math.max(0, p.pulseCooldown - dt);
    if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);

    // Carrega Overdrive com o tempo
    if (!p.overdriveActive && p.overdrive < p.maxOverdrive) {
      var overdriveGain = (C.player.overdriveRecharge || 0.1) * dt;
      p.overdrive = Math.min(p.maxOverdrive, p.overdrive + overdriveGain);
    }
  };

  entities.tryDash = function (p, input) {
    if (p.dashCooldown > 0 || p.dashTime > 0) return false;

    var move = input.getMovementVector();
    var dx, dy;

    if (move.length > 0) {
      dx = move.dx; dy = move.dy;
    } else {
      // Sem direção de movimento: avança para onde está mirando
      dx = Math.cos(p.angle); dy = Math.sin(p.angle);
    }

    var cdMul = (p.mods && p.mods.cooldownMul) || 1;
    cdMul *= (C.difficulty && C.difficulty.dashCooldownMul) || 1;

    p.dashTime = C.player.dashDuration;
    p.dashCooldown = C.player.dashCooldown * cdMul;
    p.dashVX = dx * C.player.dashSpeed;
    p.dashVY = dy * C.player.dashSpeed;
    p.dashDirX = dx;
    p.dashDirY = dy;

    SFX.dash();
    return true;
  };

  entities.tryOverdrive = function (p) {
    if (p.overdrive < p.maxOverdrive - 0.01 || p.overdriveActive) return false;

    p.overdriveActive = true;
    p.overdriveTimer = p.overdriveDuration || C.player.overdriveDuration;
    p.overdrive = 0; // consome a barra ao ativar
    p.shield = Math.min(
      p.maxShield + C.player.overdriveShieldBonus,
      p.shield + C.player.overdriveShieldBonus
    );

    P.ring(p.x, p.y, COLORS.overdrive, 26);
    P.explosion(p.x, p.y, COLORS.overdrive, 26, 280);
    SFX.overdrive();
    return true;
  };

  /**
   * Retorna true se o disparo foi efetuado.
   * @param ms  container de projéteis (o estado da missão)
   */
  entities.tryFire = function (p, input, cam, ms) {
    if (p.pulseCooldown > 0 || !p.alive) return false;
    if (p.energy < C.combat.energyCost) return false;

    var m = input.getMouse();
    var dx = (m.x + cam.x) - p.x;
    var dy = (m.y + cam.y) - p.y;
    var d = Math.hypot(dx, dy);
    if (d < 1) return false;

    var mods = p.mods || {};

    // Overdrive deixa o pulso mais forte e mais rápido.
    // Overdrive Mestre (upgrade épico) também acelera o tiro.
    var boost = p.overdriveActive ? 1.35 : 1;
    var rate = MC.powerups ? MC.powerups.fireRateMul(p) : 1;
    var damageMul = (mods.damageMul || 1) * boost;

    if (!ms || !ms.projectiles) return false;

    var proj = MC.pools.newProjectile();
    proj.kind = 'pulse';
    proj.owner = 'player';
    proj.x = p.x + (dx / d) * (p.radius + 6);
    proj.y = p.y + (dy / d) * (p.radius + 6);
    proj.vx = (dx / d) * C.combat.pulseSpeed * boost;
    proj.vy = (dy / d) * C.combat.pulseSpeed * boost;
    proj.radius = C.combat.pulseRadius;
    proj.damage = C.combat.pulseDamage * damageMul;
    proj.life = 1.6;
    proj.color = p.overdriveActive ? COLORS.overdrive : COLORS.cyan;
    proj.trailTimer = 0;
    proj.nova = !!mods.novaPulse;

    ms.projectiles.push(proj);

    p.pulseCooldown = C.combat.pulseCooldown * rate * (mods.cooldownMul || 1);
    p.energy -= C.combat.energyCost;
    P.sparks(proj.x, proj.y, proj.color, 4);
    SFX.pulse();
    return true;
  };

  entities.damagePlayer = function (p, amount) {
    if (!p.alive || p.invulnerable > 0) return false;

    // "Campo de Fase" (upgrade raro) reduz o dano recebido.
    var dr = (p.mods && p.mods.damageReduction) || 0;
    amount = amount * (1 - dr);

    // Dano por contato é contínuo: aplica no máximo 1x por "tick"
    p.shield -= amount;
    p.shieldRegenTimer = C.player.shieldRegenDelay;
    p.invulnerable = C.player.invulnTime;
    p.hitFlash = 0.25;
    p.damageTaken += amount;

    P.sparks(p.x, p.y, COLORS.danger, 10);
    MC.renderer && MC.renderer.shake(C.visual.shakeOnDamage);
    SFX.damage();

    if (p.shield <= 0) {
      p.shield = 0;
      p.alive = false;
      P.explosion(p.x, p.y, COLORS.danger, 40, 320);
      MC.renderer && MC.renderer.shake(14);
    }
    return true;
  };

  // ==========================================
  // INIMIGOS
  // ==========================================

  /**
   * Cria (ou reaproveita do pool) um inimigo.
   * @param tier  'normal' | 'elite' | 'mini' | 'boss'
   */
  entities.createEnemy = function (type, x, y, speedBoost, tier, scale) {
    var cfg = C.enemies[type];
    if (!cfg) return null;

    var e = {
      kind: 'enemy',
      type: type,
      tier: tier || 'normal',
      x: x, y: y,
      radius: cfg.radius,
      speed: 0, baseSpeed: 0,
      health: 0, maxHealth: 0,
      damage: cfg.damage,
      attackRange: cfg.attackRange,
      attackRate: cfg.attackRate,
      attackCooldown: 0,
      scoreValue: cfg.score,
      xpValue: cfg.xp || 10,
      behavior: cfg.behavior || 'pursue',
      splits: cfg.splits || 0,
      specialCooldownMax: cfg.specialCooldown || 6,
      specialCooldown: 0,
      alive: true,
      angle: 0,
      hitFlash: 0,
      spawnAnim: 0.4,
      stunTimer: 0,
      slowTimer: 0,
      // fase para os inimigos que respiram (mini-chefe / chefe)
      phase: 1,
      flashRing: 0,
    };

    entities.resetEnemy(e, type, speedBoost, scale);
    return e;
  };

  /**
   * Reaproveita um objeto de inimigo já existente.
   * É isto que o object pooling usa: nada de `new` dentro do loop.
   */
  entities.resetEnemy = function (e, type, speedBoost, scale) {
    var cfg = C.enemies[type];
    var boost = (speedBoost || 1);
    var sc = (scale || 1);

    e.type = type;
    e.behavior = cfg.behavior || 'pursue';
    e.splits = cfg.splits || 0;
    var isMini = e.tier === 'mini' || type === 'warden' || type === 'warden_boss';
    var isBoss = e.tier === 'boss' || type === 'nullTitan';
    e.radius = cfg.radius * (isMini ? 1.0 : 1) * sc; // manter base cfg
    if (isMini) e.radius = cfg.radius * sc;
    if (isBoss) e.radius = cfg.radius * sc;
    e.speed = cfg.speed * boost;
    e.baseSpeed = e.speed;
    var lifeMul = 1;
    if (C.difficulty && C.difficulty.enemyLifeMul) lifeMul *= C.difficulty.enemyLifeMul;
    if (C.difficulty && C.difficulty.bossLifeMul && (isBoss || isMini)) lifeMul *= C.difficulty.bossLifeMul;
    e.maxHealth = cfg.health * sc * lifeMul;
    e.health = e.maxHealth;
    e.damage = cfg.damage;
    e.attackRange = cfg.attackRange;
    e.attackRate = cfg.attackRate;
    e.attackCooldown = U.randomRange(0.3, 1.2);
    e.scoreValue = cfg.score;
    e.xpValue = cfg.xp || 10;
    e.specialCooldownMax = cfg.specialCooldown || 6;
    e.specialCooldown = e.specialCooldownMax * 0.6;
    e.alive = true;
    e.hitFlash = 0;
    e.spawnAnim = 0.4;
    e.stunTimer = 0;
    e.slowTimer = 0;
    e.flashRing = 0;
    e.flankSide = Math.random() < 0.5 ? -1 : 1;   // Runner: lado da aproximação
    return e;
  };

  /**
   * @param world limites e obstáculos do mundo
   * @param ms    container de projéteis (estado da missão)
   */
  entities.updateEnemy = function (e, p, dt, world, ms) {
    if (!e.alive) return;

    var dx = p.x - e.x;
    var dy = p.y - e.y;
    var d = Math.hypot(dx, dy) || 1;

    e.angle = Math.atan2(dy, dx);

    if (e.spawnAnim > 0) e.spawnAnim -= dt;
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.flashRing > 0) e.flashRing = Math.max(0, e.flashRing - dt);

    // Atordoado (laser tático) ou congelado (power-up): não age.
    if (e.stunTimer > 0) { e.stunTimer -= dt; return; }
    if (e.slowTimer > 0) e.slowTimer -= dt;

    var speedMul = (e.slowTimer > 0) ? 0.32 : 1;
    var move = 0, mx = 0, my = 0;

    switch (e.behavior) {

      case 'ranged':
        // Mantém distância: recua se colar, avança se ficar longe.
        if (d < e.attackRange * 0.55) {
          mx = -dx / d; my = -dy / d; move = 1;
        } else if (d > e.attackRange * 0.85) {
          mx = dx / d; my = dy / d; move = 1;
        } else {
          // circula um pouco para não virar tiro fixo
          mx = -dy / d; my = dx / d; move = 0.55;
        }
        break;

      case 'flank':
        // Não vai direto: tenta chegar por um dos lados.
        if (d < e.attackRange) {
          mx = -dx / d * 0.35 + (-dy / d) * e.flankSide;
          my = -dy / d * 0.35 + (dx / d) * e.flankSide;
          move = 0.8;
        } else {
          mx = dx / d; my = dy / d; move = 1;
        }
        var ml = Math.hypot(mx, my) || 1;
        mx /= ml; my /= ml;
        break;

      case 'tank':
        // Avança sempre e nunca recua.
        if (d > e.radius + p.radius + 6) {
          mx = dx / d; my = dy / d; move = 1;
        }
        break;

      case 'intercept':
        // Vai para o OBJETIVO, não para o jogador: bloqueia a rota.
        var tgt = entities.interceptTarget(ms, p);
        if (tgt) {
          var ix = tgt.x - e.x;
          var iy = tgt.y - e.y;
          var idist = Math.hypot(ix, iy) || 1;
          if (idist > 60) { mx = ix / idist; my = iy / idist; move = 1; }
        } else {
          mx = dx / d; my = dy / d; move = 1;
        }
        break;

      default: // pursue
        if (d > e.attackRange * 0.75) {
          mx = dx / d; my = dy / d; move = 1;
        }
    }

    if (move > 0) {
      var sp = e.speed * speedMul * move;
      e.x += mx * sp * dt;
      e.y += my * sp * dt;
    }

    // Fica dentro do mundo
    e.x = U.clamp(e.x, e.radius, world.width - e.radius);
    e.y = U.clamp(e.y, e.radius, world.height - e.radius);
    U.resolveCircleRects(e, world.obstacles);

    // Tiro
    e.attackCooldown -= dt;
    if (d < e.attackRange && e.attackCooldown <= 0 && p.alive) {
      e.attackCooldown = e.attackRate;
      if (ms && ms.projectiles) {
        var speed = 260 + e.speed * 0.5;
        var shot = MC.pools.newProjectile();
        shot.kind = 'pulse';
        shot.owner = 'enemy';
        shot.x = e.x + (dx / d) * (e.radius + 4);
        shot.y = e.y + (dy / d) * (e.radius + 4);
        shot.vx = (dx / d) * speed;
        shot.vy = (dy / d) * speed;
        shot.radius = 5;
        shot.damage = e.damage;
        shot.life = 2.4;
        shot.color = COLORS.danger;
        shot.trailTimer = 0;
        ms.projectiles.push(shot);
        SFX.pulse();
      }
    }

    // Elite: rajada radial periódica. É a "habilidade especial".
    if (e.behavior === 'elite') {
      e.specialCooldown -= dt;
      if (e.specialCooldown <= 0 && p.alive && d < 420) {
        e.specialCooldown = e.specialCooldownMax;
        entities.radialBurst(e, ms);
      }
    }

    // Contato é não letal: dano leve + separação entre as duas máquinas
    if (d < e.radius + p.radius) {
      if (entities.damagePlayer(p, e.damage * 0.25)) {
        var push = (e.radius + p.radius - d) + 2;
        e.x -= (dx / d) * push * 0.5;
        e.y -= (dy / d) * push * 0.5;
        p.x += (dx / d) * push * 0.5;
        p.y += (dy / d) * push * 0.5;
      }
    }
  };

  /** Alvo do Hunter: o objetivo atual da missão, se existir. */
  entities.interceptTarget = function (ms, player) {
    if (!ms || !MC.missions.currentTarget) return null;
    var t = MC.missions.currentTarget(ms, player);
    return t || null;
  };

  /** Rajada radial (habilidade do Elite). */
  entities.radialBurst = function (e, ms) {
    if (!ms || !ms.projectiles) return;

    var count = 8;
    var speed = 200;
    for (var i = 0; i < count; i++) {
      var a = (Math.PI * 2 * i) / count + (e.angle || 0);
      var shot = MC.pools.newProjectile();
      shot.kind = 'pulse';
      shot.owner = 'enemy';
      shot.x = e.x + Math.cos(a) * (e.radius + 6);
      shot.y = e.y + Math.sin(a) * (e.radius + 6);
      shot.vx = Math.cos(a) * speed;
      shot.vy = Math.sin(a) * speed;
      shot.radius = 5;
      shot.damage = e.damage * 0.5;
      shot.life = 2.0;
      shot.color = COLORS.overdrive;
      shot.trailTimer = 0;
      ms.projectiles.push(shot);
    }
    P.ring(e.x, e.y, COLORS.overdrive, e.radius + 18);
    SFX.overdrive();
  };

  /**
   * Aplica dano. Devolve true no frame em que o inimigo é desativado.
   *
   * Toda a "coleta" (pontos, XP, power-up, filhotes de Splitter) fica
   * centralizada em MC.spawner.onEnemyDown, com um guard para garantir
   * que aconteça exatamente uma vez — não importa se quem matou foi
   * o tiro básico, o laser ou um contato.
   */
  entities.damageEnemy = function (e, amount, ms) {
    if (!e.alive) return false;

    e.health -= amount;
    e.hitFlash = 0.15;
    P.sparks(e.x, e.y, COLORS.cyan, 6);
    SFX.hit();

    if (e.health <= 0) {
      e.alive = false;
      P.explosion(e.x, e.y, COLORS.cyan, 24, 240);
      SFX.enemyDown();

      // Elite explode e spawna robôs menores
      if (e.type === 'elite' && ms) {
        for (var i = 0; i < 3; i++) {
          var angle = (Math.PI * 2 * i) / 3 + Math.random() * 0.5;
          var dist = 40 + Math.random() * 30;
          var spawnX = e.x + Math.cos(angle) * dist;
          var spawnY = e.y + Math.sin(angle) * dist;
          var mini = entities.createEnemy('drone', spawnX, spawnY, 1.2, 'normal', 0.6);
          if (mini) {
            mini.speed *= 1.5;
            mini.baseSpeed = mini.speed;
            ms.enemies.push(mini);
          }
        }
        P.ring(e.x, e.y, COLORS.overdrive, 60);
        if (ms.pushEvent) ms.pushEvent(ms, 'ELITE DESTRUÍDO — FILHOTES LIBERADOS', 'bad');
        else if (MC.missions && MC.missions.pushEvent) MC.missions.pushEvent(ms, 'ELITE DESTRUÍDO — FILHOTES LIBERADOS', 'bad');
      }

      if (ms && MC.spawner) MC.spawner.onEnemyDown(ms, e);
      return true;
    }
    return false;
  };

  // ==========================================
  // PROJÉTEIS
  // ==========================================

  entities.updateProjectile = function (proj, dt, world) {
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.life -= dt;

    // Rastro
    proj.trailTimer -= dt;
    if (proj.trailTimer <= 0) {
      proj.trailTimer = 0.03;
      P.spawn(proj.x, proj.y, 0, 0, 0.18, proj.color, proj.radius * 0.7, 'dot');
    }

    // Sai do mundo = desaparece
    if (proj.x < 0 || proj.y < 0 ||
        proj.x > world.width || proj.y > world.height) {
      proj.life = 0;
    }

    return proj.life > 0;
  };

  // ==========================================
  // COLETÁVEIS
  // ==========================================

  entities.createCell = function (x, y) {
    return {
      kind: 'cell',
      x: x, y: y,
      radius: 14,
      energy: 25,
      overdrive: 12,
      alive: true,
      phase: Math.random() * Math.PI * 2,
      life: 22, // desaparece se não for coletada
    };
  };

  entities.updateCell = function (cell, dt) {
    cell.phase += dt * 3.5;
    cell.life -= dt;
    if (cell.life <= 0) cell.alive = false;
  };

  entities.collectCell = function (cell, p) {
    if (!cell.alive) return false;

    cell.alive = false;
    p.energy = Math.min(p.maxEnergy, p.energy + cell.energy);
    p.overdrive = Math.min(p.maxOverdrive, p.overdrive + cell.overdrive);
    p.cellsCollected++;

    P.pickup(cell.x, cell.y, COLORS.warning);
    SFX.collect();
    return true;
  };

  entities.createCore = function (x, y) {
    return {
      kind: 'core',
      x: x, y: y,
      radius: 24,
      captured: false,
      phase: 0,
    };
  };

  entities.createObstacle = function (x, y, w, h) {
    return { x: x, y: y, width: w, height: h };
  };

  /**
   * Gera obstáculos para o mundo mantendo livres a área inicial,
   * a base e todos os objetivos da missão.
   */
  entities.generateObstacles = function (missionData, worldW, worldH, count) {
    var cfg = C.world;
    var out = [];
    var reserved = [];
    var GAP = 70; // respiro entre obstáculo e área reservada

    function reserve(x, y, pad) {
      reserved.push({ x: x - pad, y: y - pad, width: pad * 2, height: pad * 2 });
    }

    // Reserva um corredor ligando pontos PRÓXIMOS (evita reservar o mapa inteiro)
    function reserveSegment(x1, y1, x2, y2, pad) {
      if (U.dist(x1, y1, x2, y2) > 700) return; // pulos longos não precisam de corredor
      reserved.push({
        x: Math.min(x1, x2) - pad,
        y: Math.min(y1, y2) - pad,
        width: Math.abs(x2 - x1) + pad * 2,
        height: Math.abs(y2 - y1) + pad * 2,
      });
    }

    reserve(missionData.start.x, missionData.start.y, 180);
    if (missionData.base) reserve(missionData.base.x, missionData.base.y, 140);
    if (missionData.exit) reserve(missionData.exit.x, missionData.exit.y, 140);
    if (missionData.core) reserve(missionData.core.x, missionData.core.y, 130);
    if (missionData.station) reserve(missionData.station.x, missionData.station.y, 170);
    if (missionData.door) {
      reserve(missionData.door.x + 60, missionData.door.y + missionData.door.height / 2, 150);
    }
    (missionData.waypoints || []).forEach(function (wp) {
      reserve(wp.x, wp.y, 110);
    });
    (missionData.stabilizers || []).forEach(function (s) {
      reserve(s.x, s.y, 120);
    });

    // Percorre o caminho do jogador entre os pontos do objetivo
    (function () {
      var pts = [missionData.start];
      (missionData.waypoints || []).forEach(function (p) { pts.push(p); });
      if (missionData.door) {
        pts.push({ x: missionData.door.x + 60, y: missionData.door.y + missionData.door.height / 2 });
      }
      if (missionData.core) pts.push(missionData.core);
      if (missionData.base) pts.push(missionData.base);
      if (missionData.exit) pts.push(missionData.exit);
      (missionData.stabilizers || []).forEach(function (s) { pts.push(s); });

      for (var i = 1; i < pts.length; i++) {
        reserveSegment(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, 90);
      }
    })();

    /** Teste de sobreposição real entre dois retângulos. */
    function overlaps(box, other) {
      return box.x < other.x + other.width + GAP &&
             box.x + box.width + GAP > other.x &&
             box.y < other.y + other.height + GAP &&
             box.y + box.height + GAP > other.y;
    }

    var attempts = 0;
    var maxAttempts = count * 40;

    while (out.length < count && attempts < maxAttempts) {
      attempts++;

      var w = U.randomRange(cfg.obstacleMinSize, cfg.obstacleMaxSize);
      var h = U.randomRange(cfg.obstacleMinSize, cfg.obstacleMaxSize);
      var box = {
        x: U.randomRange(60, worldW - 60 - w),
        y: U.randomRange(60, worldH - 60 - h),
        width: w,
        height: h,
      };

      var blocked = false;

      // Fora das áreas reservadas (objetivos e corredores)
      for (var r = 0; r < reserved.length; r++) {
        if (overlaps(box, reserved[r])) { blocked = true; break; }
      }
      if (blocked) continue;

      // Não sobrepor outros obstáculos
      for (var i = 0; i < out.length; i++) {
        if (overlaps(box, out[i])) { blocked = true; break; }
      }
      if (blocked) continue;

      out.push(box);
    }

    return out;
  };

  MC.entities = entities;

})(window);