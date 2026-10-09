/* ============================================
   MECH//CADET — Renderizador (Canvas 2D)
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});
  var C = MC.CONFIG;
  var COLORS = MC.COLORS;
  var U = MC.utils;

  var canvas = null;
  var ctx = null;
  var radar = null;
  var rctx = null;

  var dpr = 1;
  var view = { w: 1280, h: 720 };
  var cam = { x: 0, y: 0 };
  var shakeState = { amount: 0 };

  // ==========================================
  // SETUP
  // ==========================================

  function resize() {
    if (!canvas) return;
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    view.w = global.innerWidth;
    view.h = global.innerHeight;
    canvas.width = Math.floor(view.w * dpr);
    canvas.height = Math.floor(view.h * dpr);
    canvas.style.width = view.w + 'px';
    canvas.style.height = view.h + 'px';
  }

  function init(canvasEl, radarEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    radar = radarEl || null;
    if (radar) rctx = radar.getContext('2d');

    resize();
    global.addEventListener('resize', resize);

    // Expõe para o loop usar quando não há resize event
    MC.onResize = resize;
    return true;
  }

  function getCamera() { return cam; }

  function getView() { return view; }

  function shake(amount) {
    shakeState.amount = Math.min(24, shakeState.amount + amount);
  }

  // ==========================================
  // CÂMERA
  // ==========================================

  function clampCam(world) {
    var maxX = world.width - view.w;
    var maxY = world.height - view.h;

    if (maxX < 0) cam.x = maxX / 2;        // mundo menor que a tela: centraliza
    else cam.x = U.clamp(cam.x, 0, maxX);

    if (maxY < 0) cam.y = maxY / 2;
    else cam.y = U.clamp(cam.y, 0, maxY);
  }

  function updateCamera(target, dt, world) {
    if (!target) return;

    var desiredX = target.x - view.w / 2;
    var desiredY = target.y - view.h / 2;

    var t = C.visual.cameraLerp;
    cam.x += (desiredX - cam.x) * Math.min(1, t * 60 * dt);
    cam.y += (desiredY - cam.y) * Math.min(1, t * 60 * dt);

    clampCam(world);
  }

  function snapCamera(target, world) {
    if (!target) return;
    cam.x = target.x - view.w / 2;
    cam.y = target.y - view.h / 2;
    clampCam(world);
  }

  // ==========================================
  // PRIMITIVAS
  // ==========================================

  function drawGrid(world) {
    if (!C.visual.showGrid) return;

    var g = C.world.gridSize;
    var x0 = Math.max(0, Math.floor(cam.x / g) * g);
    var y0 = Math.max(0, Math.floor(cam.y / g) * g);
    var x1 = Math.min(world.width, cam.x + view.w);
    var y1 = Math.min(world.height, cam.y + view.h);

    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    for (var x = x0; x <= x1; x += g) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (var y = y0; y <= y1; y += g) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();

    // Linhas principais a cada 5 células
    ctx.strokeStyle = COLORS.gridMajor;
    ctx.beginPath();
    for (var mx = x0; mx <= x1; mx += g * 5) {
      ctx.moveTo(mx, y0);
      ctx.lineTo(mx, y1);
    }
    for (var my = y0; my <= y1; my += g * 5) {
      ctx.moveTo(x0, my);
      ctx.lineTo(x1, my);
    }
    ctx.stroke();
  }

  function drawWorldBounds(world) {
    ctx.strokeStyle = COLORS.cyan;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, world.width, world.height);
    ctx.globalAlpha = 1;
  }

  function drawObstacles(world) {
    for (var i = 0; i < world.obstacles.length; i++) {
      var o = world.obstacles[i];
      if (o.x + o.width < cam.x || o.x > cam.x + view.w) continue;
      if (o.y + o.height < cam.y || o.y > cam.y + view.h) continue;

      ctx.fillStyle = 'rgba(20, 60, 110, 0.42)';
      ctx.fillRect(o.x, o.y, o.width, o.height);

      ctx.strokeStyle = 'rgba(0, 217, 255, 0.32)';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x + 1, o.y + 1, o.width - 2, o.height - 2);

      // Frisos decorativos
      ctx.strokeStyle = 'rgba(0, 217, 255, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      var step = 26;
      for (var y = o.y + step; y < o.y + o.height; y += step) {
        ctx.moveTo(o.x + 4, y);
        ctx.lineTo(o.x + o.width - 4, y);
      }
      ctx.stroke();
    }
  }

  // ---------- Alvos de missão ----------

  function label(x, y, text, color) {
    ctx.font = '700 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color || COLORS.textDim;
    ctx.fillText(text, x, y);
  }

  function drawWaypoints(ms) {
    var wps = ms.data.waypoints || [];
    for (var i = 0; i < wps.length; i++) {
      var wp = wps[i];
      var done = i < ms.waypointIndex;
      var active = i === ms.waypointIndex;
      var color = done ? COLORS.success : COLORS.cyan;
      var pulse = active ? 1 + Math.sin(ms.elapsed * 4) * 0.12 : 1;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = done ? 0.35 : 0.85;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.12;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();

      label(wp.x, wp.y - wp.radius - 18, (i + 1) + '', color);
    }
  }

  function drawDashZone(ms) {
    // Suporte a dashZone (singular) e dashZones (array) - Fase 3
    var zones = ms.data.dashZones || (ms.data.dashZone ? [ms.data.dashZone] : []);
    if (!zones.length) return;

    var doneList = ms.dashZonesDone || [];

    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      var done = doneList[i];

      ctx.save();
      ctx.strokeStyle = done ? COLORS.success : COLORS.warning;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 8]);
      ctx.strokeRect(z.x, z.y, z.width, z.height);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = done ? COLORS.success : COLORS.warning;
      ctx.fillRect(z.x, z.y, z.width, z.height);
      ctx.restore();

      label(z.x + z.width / 2, z.y - 16, done ? 'CORREDOR ' + (i+1) + ' OK' : 'CORREDOR ' + (i+1) + ' — DASH', done ? COLORS.success : COLORS.warning);
    }
  }

  function drawDoor(ms) {
    var d = ms.data.door;
    if (!d) return;
    var open = ms.doorOpened;

    ctx.save();
    ctx.fillStyle = open ? 'rgba(0, 255, 136, 0.18)' : 'rgba(255, 77, 90, 0.22)';
    ctx.strokeStyle = open ? COLORS.success : COLORS.danger;
    ctx.lineWidth = 3;
    if (!open) {
      ctx.fillRect(d.x, d.y, d.width, d.height);
      ctx.strokeRect(d.x, d.y, d.width, d.height);
    } else {
      // Animation de abertura: as folhas se retraem
      var cx = d.x + d.width / 2;
      var cy = d.y + d.height / 2;
      ctx.beginPath();
      ctx.moveTo(cx, d.y);
      ctx.lineTo(cx, d.y + d.height * 0.28);
      ctx.moveTo(cx, d.y + d.height * 0.72);
      ctx.lineTo(cx, d.y + d.height);
      ctx.stroke();
    }
    ctx.restore();

    label(d.x + d.width / 2, d.y - 18, open ? 'ABERTA' : 'E', open ? COLORS.success : COLORS.danger);
  }

  function drawBase(ms) {
    var b = ms.data.base;
    if (!b) return;

    ctx.save();
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.1;
    ctx.fillStyle = COLORS.cyan;
    ctx.fill();
    ctx.restore();

    // Hachura interna
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.radius, b.y);
    ctx.lineTo(b.x + b.radius, b.y);
    ctx.moveTo(b.x, b.y - b.radius);
    ctx.lineTo(b.x, b.y + b.radius);
    ctx.stroke();
    ctx.restore();

    label(b.x, b.y - b.radius - 18, 'BASE', COLORS.cyan);
  }

  function drawExit(ms) {
    var e = ms.data.exit;
    if (!e) return;
    var ready = ms.exitReady;

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(ms.elapsed * 0.8);
    ctx.strokeStyle = ready ? COLORS.success : 'rgba(138, 180, 212, 0.6)';
    ctx.lineWidth = 4;
    var r = e.radius * (ready ? 1 : 0.7);
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r, i * (Math.PI / 2) + 0.15, i * (Math.PI / 2) + (Math.PI / 2) - 0.15);
      ctx.stroke();
    }
    ctx.restore();

    label(e.x, e.y - e.radius - 18, 'EXTRAÇÃO', ready ? COLORS.success : COLORS.textDim);
  }

  function drawStation(ms) {
    var s = ms.data.station;
    if (!s) return;

    var pct = U.clamp(ms.stationHealth / s.maxHealth, 0, 1);
    var color = pct > 0.5 ? COLORS.success : (pct > 0.25 ? COLORS.warning : COLORS.danger);
    var flash = ms.stationHitFlash > 0;

    ctx.save();
    ctx.translate(s.x, s.y);

    ctx.globalAlpha = flash ? 0.4 : 0.14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Anel de integridade
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(0, 0, s.radius - 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius - 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();

    // Núcleo
    ctx.rotate(ms.elapsed * 0.6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(-14, -14, 28, 28);
    ctx.restore();

    label(s.x, s.y - s.radius - 20, 'ESTAÇÃO ' + Math.round(pct * 100) + '%', color);
  }

  function drawCore(ms) {
    var core = ms.core;
    if (!core) return;

    if (ms.coreCaptured) {
      // Ícone no HUD do jogador é suficiente; nada no mundo
      return;
    }

    ctx.save();
    ctx.translate(core.x, core.y);
    var pulse = 1 + Math.sin(core.phase) * 0.12;

    ctx.strokeStyle = COLORS.cyan;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, core.radius * 2.2 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.rotate(core.phase * 0.8);
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 3;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, core.radius * pulse, i * (Math.PI * 2 / 3), i * (Math.PI * 2 / 3) + 1.6);
      ctx.stroke();
    }
    ctx.rotate(-core.phase * 1.6);

    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.arc(0, 0, core.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    label(core.x, core.y - core.radius * 2.6, 'NÚCLEO', COLORS.cyan);
  }

  function drawStabilizers(ms) {
    for (var i = 0; i < ms.stabilizers.length; i++) {
      var s = ms.stabilizers[i];
      var color = s.disabled ? 'rgba(138, 180, 212, 0.35)' : COLORS.warning;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = (Math.PI / 3) * k + (s.disabled ? 0 : ms.elapsed * 0.5);
        var px = Math.cos(a) * s.radius;
        var py = Math.sin(a) * s.radius;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      if (!s.disabled && s.progress > 0) {
        ctx.fillStyle = COLORS.success;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, s.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.progress);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      label(s.x, s.y - s.radius - 18, s.label + (s.disabled ? ' OFF' : ''), color);
    }
  }

  function drawDataBoxes(ms) {
    var boxes = ms.data.dataBoxes;
    if (!boxes || !boxes.length) return;
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      if (box.hp <= 0) continue; // já destruída

      ctx.save();
      ctx.translate(box.x, box.y);
      var pulse = 1 + Math.sin(ms.elapsed * 3 + i) * 0.15;

      // Anel externo pulsante
      ctx.strokeStyle = COLORS.cyan;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, box.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Corpo da caixa (hexágono de dados)
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(0, 60, 100, 0.85)';
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = (Math.PI / 3) * k + ms.elapsed * 0.5;
        var px = Math.cos(a) * box.radius * pulse;
        var py = Math.sin(a) * box.radius * pulse;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ícone de "dados" no centro
      ctx.fillStyle = COLORS.cyan;
      ctx.font = 'bold ' + (box.radius * 0.7) + 'px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('D', 0, 1);

      ctx.restore();

      label(box.x, box.y - box.radius - 18, 'CAIXA DE DADOS ' + (i + 1), COLORS.cyan);
    }
  }

  // ---------- Personagens ----------

  function drawPlayer(p) {
    if (!p) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Escudo (raio efetivo)
    ctx.strokeStyle = p.overdriveActive ? COLORS.overdrive : 'rgba(0, 217, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.globalAlpha = p.dashing ? 0.9 : 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.rotate(p.angle + Math.PI / 2);

    // Sombra do corpo
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : '#0d2a4a';
    ctx.strokeStyle = p.hitFlash > 0 ? COLORS.danger : COLORS.cyan;
    ctx.lineWidth = 3;

    // Corpo principal (losango apontando para frente)
    ctx.beginPath();
    ctx.moveTo(0, -p.radius);
    ctx.lineTo(p.radius * 0.82, -p.radius * 0.1);
    ctx.lineTo(p.radius * 0.55, p.radius);
    ctx.lineTo(-p.radius * 0.55, p.radius);
    ctx.lineTo(-p.radius * 0.82, -p.radius * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Braços / canhões
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-p.radius * 0.75, -p.radius * 0.1);
    ctx.lineTo(-p.radius * 0.75, -p.radius * 0.95);
    ctx.moveTo(p.radius * 0.75, -p.radius * 0.1);
    ctx.lineTo(p.radius * 0.75, -p.radius * 0.95);
    ctx.stroke();

    // Cockpit
    ctx.fillStyle = p.overdriveActive ? COLORS.overdrive : COLORS.cyan;
    ctx.beginPath();
    ctx.arc(0, -p.radius * 0.25, p.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Propulsores
    if (p.dashing) {
      ctx.fillStyle = COLORS.blue;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(-p.radius * 0.5, p.radius);
      ctx.lineTo(0, p.radius + 26);
      ctx.lineTo(p.radius * 0.5, p.radius);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawEnemy(e) {
    if (!e.alive) return;

    var spawnFade = e.spawnAnim > 0 ? (1 - e.spawnAnim / 0.4) : 1;

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.globalAlpha = U.clamp(spawnFade, 0.1, 1);
    ctx.rotate(e.angle);
    ctx.strokeStyle = e.hitFlash > 0 ? '#ffffff' : COLORS.danger;
    ctx.fillStyle = e.hitFlash > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(60, 12, 24, 0.75)';
    ctx.lineWidth = 2.5;

    if (e.type === 'drone') {
      ctx.beginPath();
      ctx.moveTo(e.radius, 0);
      ctx.lineTo(0, e.radius * 0.8);
      ctx.lineTo(-e.radius, 0);
      ctx.lineTo(0, -e.radius * 0.8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.danger;
      ctx.beginPath();
      ctx.arc(e.radius * 0.25, 0, 3, 0, Math.PI * 2);
      ctx.fill();

    } else if (e.type === 'sentinel') {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI / 3) * i;
        var px = Math.cos(a) * e.radius;
        var py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();

    } else if (e.type === 'runner') {
      // Losango fino: velocidade
      ctx.beginPath();
      ctx.moveTo(e.radius * 1.4, 0);
      ctx.lineTo(-e.radius * 0.9, e.radius * 0.75);
      ctx.lineTo(-e.radius * 0.3, 0);
      ctx.lineTo(-e.radius * 0.9, -e.radius * 0.75);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = COLORS.warning;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.4, -e.radius * 0.5);
      ctx.lineTo(-e.radius * 1.3, -e.radius * 0.5);
      ctx.moveTo(-e.radius * 0.4, e.radius * 0.5);
      ctx.lineTo(-e.radius * 1.3, e.radius * 0.5);
      ctx.stroke();

    } else if (e.type === 'shooter' || e.type === 'sentinel') {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI / 3) * i;
        var px = Math.cos(a) * e.radius;
        var py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.warning;
      ctx.beginPath();
      ctx.arc(e.radius * 0.3, 0, 4, 0, Math.PI * 2);
      ctx.fill();

    } else if (e.type === 'tank') {
      // Quadrado grosso: escudo pesado
      ctx.fillStyle = 'rgba(90, 20, 10, 0.85)';
      ctx.fillRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
      ctx.strokeRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
      ctx.fillStyle = COLORS.warning;
      ctx.fillRect(-e.radius * 0.4, -e.radius * 0.25, e.radius * 1.1, e.radius * 0.5);

    } else if (e.type === 'splitter') {
      // Circulo com linhas de fratura: promete que vai virar dois
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = COLORS.textDim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius); ctx.lineTo(0, e.radius);
      ctx.moveTo(-e.radius, 0); ctx.lineTo(e.radius, 0);
      ctx.stroke();

    } else if (e.type === 'hunter') {
      // Seta: corta caminho
      ctx.beginPath();
      ctx.moveTo(e.radius * 1.5, 0);
      ctx.lineTo(-e.radius, e.radius * 0.85);
      ctx.lineTo(-e.radius * 0.35, 0);
      ctx.lineTo(-e.radius, -e.radius * 0.85);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.overdrive;
      ctx.beginPath();
      ctx.arc(e.radius * 0.35, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (e.type === 'elite') {
      // Anel duplo girando: raridade visível à distância
      ctx.strokeStyle = COLORS.overdrive;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.rotate(e.flashRing * 2);
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = COLORS.overdrive;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.28, 0, Math.PI * 2);
      ctx.fill();

    } else { // guardian
      ctx.fillStyle = 'rgba(90, 20, 10, 0.8)';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      ctx.strokeStyle = COLORS.overdrive;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (var k = 0; k < 4; k++) {
        var aa = (Math.PI / 2) * k;
        ctx.moveTo(Math.cos(aa) * (e.radius * 0.55), Math.sin(aa) * (e.radius * 0.55));
        ctx.lineTo(Math.cos(aa) * (e.radius * 1.35), Math.sin(aa) * (e.radius * 1.35));
      }
      ctx.stroke();

      // Anel de escudo
      var pct = U.clamp(e.health / e.maxHealth, 0, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = pct > 0.35 ? COLORS.warning : COLORS.danger;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
    }

    // Atordoado: anel de "não pode agir"
    if (e.stunTimer > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Barra de vida: só quando o inimigo já levou dano
    if (e.type !== 'guardian' && e.health < e.maxHealth) {
      var w = e.radius * 2.4;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 4);
      ctx.fillStyle = COLORS.danger;
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.health / e.maxHealth), 4);
    }
  }

  function drawProjectiles(list) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCells(list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c.alive) continue;

      var fade = c.life < 4 ? (Math.sin(c.life * 10) > 0 ? 1 : 0.35) : 1;
      var bob = Math.sin(c.phase) * 4;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(c.x, c.y + bob);
      ctx.rotate(c.phase * 0.5);
      ctx.fillStyle = COLORS.warning;
      ctx.strokeStyle = '#fff2c2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-c.radius * 0.55, -c.radius * 0.8, c.radius * 1.1, c.radius * 1.6);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- V2: XP, power-ups e laser ----------

  function drawXPOrbs(list) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];

      // Piscando antes de sumir: dá tempo de a criança pegar.
      var fade = o.life < 3 ? (Math.sin(o.life * 14) > 0 ? 1 : 0.3) : 1;
      var bob = Math.sin(o.phase) * 3;

      ctx.save();
      ctx.globalAlpha = fade;

      // Halo
      ctx.fillStyle = COLORS.cyan;
      ctx.globalAlpha = fade * 0.25;
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, o.radius * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Núcleo
      ctx.globalAlpha = fade;
      ctx.fillStyle = COLORS.cyan;
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, o.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPowerDrops(list) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var info = MC.powerups.TYPES[o.type];
      if (!info) continue;

      var fade = o.life < 3 ? (Math.sin(o.life * 14) > 0 ? 1 : 0.3) : 1;
      var bob = Math.sin(o.phase) * 4;
      var rot = o.phase * 0.6;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(o.x, o.y + bob);

      // Hexágono girando
      ctx.rotate(rot);
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = (Math.PI / 3) * k;
        var px = Math.cos(a) * o.radius;
        var py = Math.sin(a) * o.radius;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();

      ctx.fillStyle = info.color;
      ctx.globalAlpha = fade * 0.3;
      ctx.fill();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.rotate(-rot);
      label(0, 0, info.label.charAt(0), info.color);
      ctx.restore();
    }
  }

  function drawLasers(list) {
    if (!list) return;

    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var k = U.clamp(b.life / b.maxLife, 0, 1);

      ctx.save();
      ctx.lineCap = 'round';

      // Halo largo e fraco
      ctx.globalAlpha = 0.22 * k;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * 3.2;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      // Núcleo
      ctx.globalAlpha = 0.7 * k;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      // Fio branco no centro
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, b.width * 0.3);
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.restore();
    }
  }

  // ---------- Camada de tela ----------

  function drawVignette() {
    var g = ctx.createRadialGradient(
      view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35,
      view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function drawCrosshair(mouse) {
    var x = mouse.x;
    var y = mouse.y;

    ctx.save();
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 22, y); ctx.lineTo(x - 8, y);
    ctx.moveTo(x + 8, y);  ctx.lineTo(x + 22, y);
    ctx.moveTo(x, y - 22); ctx.lineTo(x, y - 8);
    ctx.moveTo(x, y + 8);  ctx.lineTo(x, y + 22);
    ctx.stroke();

    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Seta apontando o objetivo quando ele está fora da tela. */
  function drawObjectiveArrow(target, player) {
    if (!target) return;

    var sx = target.x - cam.x;
    var sy = target.y - cam.y;
    var margin = 46;

    var onScreen = sx > margin && sx < view.w - margin &&
                   sy > margin && sy < view.h - margin;
    if (onScreen) return;

    var angle = Math.atan2(target.y - player.y, target.x - player.x);

    // Encontra a borda da tela na direção do alvo
    var cx = view.w / 2;
    var cy = view.h / 2;
    var halfW = view.w / 2 - margin;
    var halfH = view.h / 2 - margin;
    var t = Math.min(
      halfW / Math.max(0.0001, Math.abs(Math.cos(angle))),
      halfH / Math.max(0.0001, Math.abs(Math.sin(angle)))
    );

    var ax = cx + Math.cos(angle) * t;
    var ay = cy + Math.sin(angle) * t;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);

    ctx.fillStyle = COLORS.warning;
    ctx.shadowColor = COLORS.warning;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    var dist = Math.round(U.dist(player.x, player.y, target.x, target.y));
    ctx.save();
    ctx.font = '700 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.warning;
    ctx.fillText(target.label + ' ' + dist + 'm', ax - Math.cos(angle) * 26, ay - Math.sin(angle) * 26 + 4);
    ctx.restore();
  }

  /** Radar / minimapa no canto superior direito. */
  function drawRadar(state) {
    if (!rctx || !state.world) return;

    var W = radar.width;
    var H = radar.height;
    var world = state.world;
    var ms = state.mission;

    rctx.clearRect(0, 0, W, H);
    rctx.fillStyle = 'rgba(5, 12, 24, 0.9)';
    rctx.fillRect(0, 0, W, H);

    var sx = W / world.width;
    var sy = H / world.height;

    // Obstáculos
    rctx.fillStyle = 'rgba(0, 217, 255, 0.18)';
    for (var i = 0; i < world.obstacles.length; i++) {
      var o = world.obstacles[i];
      rctx.fillRect(o.x * sx, o.y * sy, o.width * sx, o.height * sy);
    }

    // Base / saída / estação
    if (ms && ms.data.base) {
      rctx.strokeStyle = COLORS.cyan;
      rctx.lineWidth = 1;
      rctx.beginPath();
      rctx.arc(ms.data.base.x * sx, ms.data.base.y * sy, 5, 0, Math.PI * 2);
      rctx.stroke();
    }
    if (ms && ms.data.exit) {
      rctx.strokeStyle = ms.exitReady ? COLORS.success : COLORS.textDim;
      rctx.beginPath();
      rctx.arc(ms.data.exit.x * sx, ms.data.exit.y * sy, 5, 0, Math.PI * 2);
      rctx.stroke();
    }

    // Inimigos
    if (ms) {
      rctx.fillStyle = COLORS.danger;
      for (var e = 0; e < ms.enemies.length; e++) {
        var en = ms.enemies[e];
        if (!en.alive) continue;
        rctx.fillRect(en.x * sx - 1.5, en.y * sy - 1.5, 3, 3);
      }
    }

    // Objetivo
    if (state.target) {
      rctx.strokeStyle = COLORS.warning;
      rctx.lineWidth = 2;
      rctx.beginPath();
      rctx.arc(state.target.x * sx, state.target.y * sy, 5, 0, Math.PI * 2);
      rctx.stroke();
    }

    // Jogador (triângulo apontando para a mira)
    if (state.player) {
      var p = state.player;
      rctx.save();
      rctx.translate(p.x * sx, p.y * sy);
      rctx.rotate(p.angle + Math.PI / 2);
      rctx.fillStyle = '#ffffff';
      rctx.beginPath();
      rctx.moveTo(0, -5);
      rctx.lineTo(3.5, 4);
      rctx.lineTo(-3.5, 4);
      rctx.closePath();
      rctx.fill();
      rctx.restore();
    }

    // Borda
    rctx.strokeStyle = 'rgba(0, 217, 255, 0.35)';
    rctx.lineWidth = 1;
    rctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    // Visão atual (retângulo da câmera)
    rctx.strokeStyle = 'rgba(255,255,255,0.25)';
    rctx.strokeRect(cam.x * sx, cam.y * sy, view.w * sx, view.h * sy);
  }

  // ==========================================
  // RENDER PRINCIPAL
  // ==========================================

  function render(state, dt) {
    if (!ctx || !state.world) return;

    // Tremor de tela
    var sx = 0, sy = 0;
    if (shakeState.amount > 0.2) {
      sx = U.randomRange(-shakeState.amount, shakeState.amount);
      sy = U.randomRange(-shakeState.amount, shakeState.amount);
      shakeState.amount *= C.visual.shakeDecay;
    } else {
      shakeState.amount = 0;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, view.w, view.h);

    var ms = state.mission;

    ctx.save();
    ctx.translate(-cam.x + sx, -cam.y + sy);

    drawGrid(state.world);
    drawWorldBounds(state.world);
    drawObstacles(state.world);

    if (ms) {
      if (ms.data.type === 'tutorial') {
        drawWaypoints(ms);
        drawDashZone(ms);
        drawDoor(ms);
        // Caixas de dados (Fase 4)
        if (ms.data.dataBoxes && ms.data.dataBoxes.length) drawDataBoxes(ms);
      } else if (ms.data.type === 'capture') {
        drawBase(ms);
        drawCore(ms);
      } else if (ms.data.type === 'defense') {
        drawStation(ms);
      } else if (ms.data.type === 'stabilizers') {
        drawStabilizers(ms);
        drawExit(ms);
      }

      drawCells(ms.cells);
      drawXPOrbs(ms.xpOrbs);
      drawPowerDrops(ms.powerDrops);
      drawLasers(ms.lasers);
      drawProjectiles(ms.projectiles);

      for (var i = 0; i < ms.enemies.length; i++) {
        drawEnemy(ms.enemies[i]);
      }
    }

    MC.particles.draw(ctx);

    if (state.player) drawPlayer(state.player);

    ctx.restore();

    drawVignette();

    if (state.scene === 'gameplay' && !state.paused) {
      drawObjectiveArrow(state.target, state.player);
      if (state.player && state.player.alive) {
        drawCrosshair(MC.input.getMouse());
      }
      drawRadar(state);
    }
  }

  function clear() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, view.w, view.h);
    if (rctx) rctx.clearRect(0, 0, radar.width, radar.height);
  }

  MC.renderer = {
    init: init,
    resize: resize,
    clear: clear,
    render: render,
    updateCamera: updateCamera,
    snapCamera: snapCamera,
    getCamera: getCamera,
    getView: getView,
    shake: shake,
  };

})(window);