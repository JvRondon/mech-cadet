/* ============================================
   MECH//CADET — Activity Director (V2)
   Regra do projeto: zero momentos de ociosidade.
   Sempre existe decisão, ameaça, objetivo ou progressão.

   IMPORTANTE — isto NÃO pune a criança.
   Se ela parar, o jogo cria uma SITUAÇÃO (inimigo, dica, rota),
   nunca uma penalidade (dano, tela vermelha, tempo correndo).
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;

  var HINTS = [
    'PERTO DO OBJETIVO? USE O DASH.',
    'O XP FICA NO CHÃO. CIRCULE PARA PEGAR.',
    'CLIQUE PARA ATIRAR. SEGURE PARA CONTINUAR.',
    'PRESSO E DASH ATRAVESSAM INIMIGOS.',
    'OVERDRIVE (Q) DURA 4 SEGUNDOS.',
    'O ESCUDO VOLTA SOZINHO. RESPIRE.',
  ];

  var director = {
    idleTime: 0,
    stepIndex: 0,
    worstIdle: 0,
    hintIndex: 0,
    fired: false,
    calm: false,

    /** Zera o medidor. Chamar no início de cada fase. */
    reset: function () {
      this.idleTime = 0;
      this.stepIndex = 0;
      this.worstIdle = 0;
      this.hintIndex = 0;
      this.fired = false;
      this.calm = false;
    },

    /**
     * @param ms      estado da missão
     * @param dt      segundos do frame
     * @param player
     * @param ctx {
     *   isMoving, isFiring, threatCount,
     *   ox, oy            centro sugerido para o grupo nascer
     *   directionHint     texto que aponta para o objetivo
     *   isSelfDriven       true quando a fase já é pressão por si
     * }
     */
    update: function (ms, dt, player, ctx) {
      ctx = ctx || {};
      if (!ms || !player || !player.alive) return;
      if (MC.missions && ms.state !== MC.missions.STATE.ACTIVE) return;

      // Se a fase já é pressão por si (chefe ativo, captura rolando),
      // não faz sentido medir ociosidade: zera e sai.
      if (ctx.isSelfDriven || ms.boss) {
        this.reset();
        return;
      }

      if (ctx.isMoving || ctx.isFiring || ctx.threatCount > 0) {
        this.idleTime = 0;
        this.stepIndex = 0;
        return;
      }

      this.idleTime += dt;
      if (this.idleTime > this.worstIdle) this.worstIdle = this.idleTime;

      var steps = C.activity.steps;
      while (this.stepIndex < steps.length &&
             this.idleTime >= steps[this.stepIndex].after) {
        var step = steps[this.stepIndex];
        this.stepIndex++;
        this.apply(ms, step, player, ctx);
      }
    },

    /** Executa um degrau da escada de estímulo. */
    apply: function (ms, step, player, ctx) {
      switch (step.action) {

        case 'group':
          MC.spawner.spawnGroup(ms, {
            count: step.count || 2,
            originX: ctx.ox, originY: ctx.oy,
            radius: step.radius || 300,
          });
          this.fired = true;
          break;

        case 'hint':
          this.hint(ctx);
          break;

        case 'surge':
          // Escalada: mais inimigos, do conjunto já liberado na fase.
          MC.spawner.spawnGroup(ms, {
            count: step.count || 4,
            originX: ctx.ox, originY: ctx.oy,
            radius: step.radius || 420,
            allowed: ms.allowedTypes,
          });
          this.calm = false;
          this.fired = true;
          break;
      }
    },

    hint: function (ctx) {
      // A dica mais útil é a que aponta para onde o objetivo está.
      var text = ctx.directionHint || HINTS[this.hintIndex % HINTS.length];
      this.hintIndex++;

      if (MC.ui && MC.ui.pushEvent) MC.ui.pushEvent(text, 'info', 3.2);
      if (MC.audio && MC.audio.SFX) MC.audio.SFX.warning();
    },
  };

  MC.activityDirector = director;

})(window);