/* ============================================
   MECH//CADET — Utilidades e Física
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});

  var utils = {
    clamp: function (v, min, max) {
      return v < min ? min : (v > max ? max : v);
    },

    lerp: function (a, b, t) {
      return a + (b - a) * t;
    },

    dist: function (ax, ay, bx, by) {
      return Math.hypot(bx - ax, by - ay);
    },

    dist2: function (ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay;
      return dx * dx + dy * dy;
    },

    angleTo: function (ax, ay, bx, by) {
      return Math.atan2(by - ay, bx - ax);
    },

    normalizeAngle: function (angle) {
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      return angle;
    },

    rotateToward: function (current, target, t) {
      return current + utils.normalizeAngle(target - current) * t;
    },

    circlesOverlap: function (a, b) {
      var r = a.radius + b.radius;
      return utils.dist2(a.x, a.y, b.x, b.y) < r * r;
    },

    randomRange: function (min, max) {
      return min + Math.random() * (max - min);
    },

    randomInt: function (min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    pick: function (arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },

    // Empurra `circle` para fora do retângulo, se estiverem sobrepostos.
    resolveCircleRect: function (circle, rect) {
      var closestX = utils.clamp(circle.x, rect.x, rect.x + rect.width);
      var closestY = utils.clamp(circle.y, rect.y, rect.y + rect.height);
      var dx = circle.x - closestX;
      var dy = circle.y - closestY;
      var d = Math.hypot(dx, dy);

      if (d === 0) {
        // Centro dentro do retângulo: empurra pela borda mais próxima.
        var left = circle.x - rect.x;
        var right = rect.x + rect.width - circle.x;
        var top = circle.y - rect.y;
        var bottom = rect.y + rect.height - circle.y;
        var min = Math.min(left, right, top, bottom);
        if (min === left) circle.x = rect.x - circle.radius;
        else if (min === right) circle.x = rect.x + rect.width + circle.radius;
        else if (min === top) circle.y = rect.y - circle.radius;
        else circle.y = rect.y + rect.height + circle.radius;
        return true;
      }

      if (d < circle.radius) {
        var overlap = circle.radius - d;
        circle.x += (dx / d) * overlap;
        circle.y += (dy / d) * overlap;
        return true;
      }
      return false;
    },

    // Colisão contra vários retângulos
    resolveCircleRects: function (circle, rects) {
      var hit = false;
      for (var i = 0; i < rects.length; i++) {
        // Teste rápido por AABB
        var r = rects[i];
        if (circle.x + circle.radius < r.x ||
            circle.x - circle.radius > r.x + r.width ||
            circle.y + circle.radius < r.y ||
            circle.y - circle.radius > r.y + r.height) continue;

        if (utils.resolveCircleRect(circle, r)) hit = true;
      }
      return hit;
    },

    formatTime: function (seconds) {
      var s = Math.max(0, Math.floor(seconds));
      var m = Math.floor(s / 60);
      return m + ':' + String(s % 60).padStart(2, '0');
    },

    // Evita que um objetivo fique preso dentro de um obstáculo.
    isInsideAnyRect: function (x, y, rects, pad) {
      pad = pad || 0;
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (x > r.x - pad && x < r.x + r.width + pad &&
            y > r.y - pad && y < r.y + r.height + pad) return true;
      }
      return false;
    },

    // ---------- Geometria (V2) ----------

    /**
     * Distância de um ponto até um segmento.
     * Usado pelo laser tático para saber quais inimigos ele cruza.
     * Se o ponto projeta além das pontas, devolve a distância até a ponta.
     */
    distToSegment: function (px, py, x1, y1, x2, y2) {
      var dx = x2 - x1;
      var dy = y2 - y1;
      var len2 = dx * dx + dy * dy;
      if (len2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));

      var t = ((px - x1) * dx + (py - y1) * dy) / len2;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);

      var cx = x1 + t * dx;
      var cy = y1 + t * dy;
      return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
    },

    /** Retângulo x círculo: true se encostam. */
    circleRectOverlap: function (cx, cy, r, rect) {
      var nx = clamp(cx, rect.x, rect.x + rect.width);
      var ny = clamp(cy, rect.y, rect.y + rect.height);
      var dx = cx - nx;
      var dy = cy - ny;
      return dx * dx + dy * dy < r * r;
    },

    /** Dois retângulos se sobrepõem? (usa metade da área, margem de tolerância). */
    rectsOverlap: function (a, b, margin) {
      margin = margin || 0;
      return !(a.x + a.width + margin < b.x ||
               b.x + b.width + margin < a.x ||
               a.y + a.height + margin < b.y ||
               b.y + b.height + margin < a.y);
    },
  };

  MC.utils = utils;
  MC.clamp = utils.clamp;

})(window);