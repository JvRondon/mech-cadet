/* ============================================
   MECH//CADET — Object Pool (V2)
   Reciclagem de objetos para aguentar densidade
   de inimigos sem alocar memória todo frame.
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});

  /**
   * Cria um pool genérico.
   *
   * @param factory  function() -> objeto novo (usado só quando o pool seca)
   * @param reset    function(obj)  called on release
   * @param prealloc número de objetos pré-alocados (evita picos no primeiro frame)
   */
  function Pool(factory, reset, prealloc) {
    this.factory = factory;
    this.reset = reset || function () {};
    this.free = [];
    this.made = 0;
    for (var i = 0; i < (prealloc || 0); i++) {
      this.free.push(factory());
      this.made++;
    }
  }

  /** Retira um objeto do pool (cria um novo se não houver). */
  Pool.prototype.get = function () {
    var o = this.free.pop();
    if (!o) {
      o = this.factory();
      this.made++;
    }
    return o;
  };

  /** Devolve o objeto ao pool. */
  Pool.prototype.release = function (o) {
    if (!o) return;
    // O mesmo objeto não pode entrar duas vezes na lista livre: o
    // segundo get() entregaria a mesma referência para dois donos, e
    // um deles apagaria o estado do outro sem querer.
    if (o._pool === this) return;
    o._pool = this;
    this.reset(o);
    this.free.push(o);
  };

  Pool.prototype.reset = function () { this.free.length = 0; };

  /** Estatísticas para o painel de performance. */
  Pool.prototype.stats = function () {
    return { free: this.free.length, made: this.made };
  };

  MC.Pool = Pool;

  // ==========================================
  // Pool de entidades do jogo
  // ==========================================

  MC.pools = {};

  /**
   * Pool de projéteis.
   *
   * É o objeto mais criado do jogo (cada tiro do jogador, de cada
   * inimigo e de cada rajada de Elite passa por aqui). Por isso o
   * reset é agressivo: qualquer campo esquecido no reset reaparece como
   * projétil fantasma. Por isso `kind` e `owner` são reescritos.
   */
  MC.pools.getProjectiles = function () {
    if (MC.pools._proj) return MC.pools._proj;

    MC.pools._proj = new Pool(
      function () {
        return {
          kind: 'pulse', owner: 'enemy',
          x: 0, y: 0, vx: 0, vy: 0,
          radius: 5, damage: 0, life: 0,
          color: '#fff', trailTimer: 0,
          nova: false, alive: true,
        };
      },
      function (p) {
        p.alive = false;
        p.life = 0;
        p.trailTimer = 0;
        p.nova = false;
      },
      120
    );
    return MC.pools._proj;
  };

  // ==========================================
  // Helpers de projétil
  // ==========================================

  /** Cria um projétil vindo do pool. */
  MC.pools.newProjectile = function () {
    var p = MC.pools.getProjectiles().get();
    p.alive = true;
    p.life = 0;
    p.trailTimer = 0;
    p.nova = false;
    return p;
  };

  /** Devolve um projétil ao pool. */
  MC.pools.freeProjectile = function (p) {
    MC.pools.getProjectiles().release(p);
  };

  /** Pool de orbes de XP. */
  MC.pools.getXP = function () {
    if (MC.pools._xp) return MC.pools._xp;

    MC.pools._xp = new Pool(
      function () {
        return {
          kind: 'xp', x: 0, y: 0,
          amount: 1, life: 0, radius: 6,
          vx: 0, vy: 0, phase: 0,
          magnet: false, alive: true,
        };
      },
      function (o) { o.alive = false; o.magnet = false; },
      100
    );
    return MC.pools._xp;
  };

  /** Pool de power-ups. */
  MC.pools.getPowerUps = function () {
    if (MC.pools._pw) return MC.pools._pw;

    MC.pools._pw = new Pool(
      function () {
        return {
          kind: 'powerup', type: 'shield',
          x: 0, y: 0, radius: 14,
          life: 0, phase: 0, alive: true,
        };
      },
      function (o) { o.alive = false; },
      12
    );
    return MC.pools._pw;
  };

  /** Esvazia todos os pools (troca de fase). */
  MC.pools.releaseAll = function () {
    var names = ['_proj', '_xp', '_pw'];
    for (var i = 0; i < names.length; i++) {
      var p = MC.pools[names[i]];
      if (p) p.reset();
    }
  };

})(window);
