/* ============================================
   MECH//CADET — Sistema de Partículas
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;
  var COLORS = MC.COLORS;

  var items = [];

  function push(p) {
    if (items.length >= C.particles.max) items.shift();
    items.push(p);
  }

  MC.particles = {
    /** Partícula genérica */
    spawn: function (x, y, vx, vy, life, color, size, shape) {
      push({
        x: x, y: y, vx: vx, vy: vy,
        life: life, maxLife: life,
        color: color, size: size,
        shape: shape || 'dot',
        alpha: 1,
        drag: 0.96,
      });
    },

    /** Explosão radial de partículas */
    explosion: function (x, y, color, count, speed) {
      count = count || 22;
      speed = speed || 220;
      for (var i = 0; i < count; i++) {
        var a = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        var s = speed * MC.utils.randomRange(0.4, 1);
        push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: MC.utils.randomRange(0.35, 0.75), maxLife: 0.75,
          color: color, size: MC.utils.randomRange(2, 5),
          shape: 'line', alpha: 1, drag: 0.92,
        });
      }
    },

    /** Faíscas curtas (impacto) */
    sparks: function (x, y, color, count) {
      count = count || 8;
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var s = MC.utils.randomRange(90, 260);
        push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: MC.utils.randomRange(0.15, 0.32), maxLife: 0.32,
          color: color, size: MC.utils.randomRange(1.5, 3),
          shape: 'line', alpha: 1, drag: 0.9,
        });
      }
    },

    /** Rastro do dash */
    dashTrail: function (x, y, angle) {
      for (var i = 0; i < 3; i++) {
        var spread = MC.utils.randomRange(-0.5, 0.5);
        var a = angle + Math.PI + spread;
        var s = MC.utils.randomRange(40, 120);
        push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: MC.utils.randomRange(0.18, 0.34), maxLife: 0.34,
          color: COLORS.cyan, size: MC.utils.randomRange(2, 4),
          shape: 'dot', alpha: 1, drag: 0.93,
        });
      }
    },

    /** Anel de energia em expansão */
    ring: function (x, y, color, size) {
      push({
        x: x, y: y, vx: 0, vy: 0,
        life: 0.45, maxLife: 0.45,
        color: color || COLORS.cyan,
        size: size || 20,
        shape: 'ring', alpha: 1, drag: 1,
      });
    },

    /** Exaustão do motor */
    exhaust: function (x, y, angle) {
      var a = angle + Math.PI + MC.utils.randomRange(-0.4, 0.4);
      push({
        x: x, y: y,
        vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
        life: 0.28, maxLife: 0.28,
        color: COLORS.blue, size: MC.utils.randomRange(1.5, 3),
        shape: 'dot', alpha: 1, drag: 0.94,
      });
    },

    /** Bolha de coleta */
    pickup: function (x, y, color) {
      for (var i = 0; i < 10; i++) {
        var a = (Math.PI * 2 * i) / 10;
        var s = 90;
        push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.4, maxLife: 0.4,
          color: color || COLORS.warning, size: 3,
          shape: 'dot', alpha: 1, drag: 0.9,
        });
      }
      MC.particles.ring(x, y, color || COLORS.warning, 14);
    },

    update: function (dt) {
      for (var i = items.length - 1; i >= 0; i--) {
        var p = items[i];
        p.life -= dt;

        if (p.life <= 0) {
          items.splice(i, 1);
          continue;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.alpha = p.life / p.maxLife;
      }
    },

    draw: function (ctx) {
      for (var i = 0; i < items.length; i++) {
        var p = items[i];
        var a = p.alpha;

        ctx.save();
        ctx.globalAlpha = a;

        if (p.shape === 'ring') {
          var progress = 1 - a;
          var r = p.size * (0.4 + progress * 2.6);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.shape === 'line') {
          // Rastro no sentido do movimento
          var len = Math.hypot(p.vx, p.vy) * 0.035;
          var ux = p.vx, uy = p.vy;
          var mag = Math.hypot(ux, uy) || 1;
          ux /= mag; uy /= mag;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * a;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - ux * len, p.y - uy * len);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    },

    clear: function () { items.length = 0; },
    count: function () { return items.length; },
  };

})(window);