/* ============================================
   MECH//CADET — Entrada (Teclado e Mouse)
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});

  var keys = Object.create(null);       // teclas currently held
  var pressed = Object.create(null);    // teclas pressed neste frame (edge)
  var mouse = {
    x: 0, y: 0,
    down: false,
    rightDown: false,
    clicked: false,   // consumed via consumeClick()
    click: false,
  };

  var canvasEl = null;
  var blockDefault = {
    Space: true,
    ArrowUp: true, ArrowDown: true, ArrowLeft: true, ArrowRight: true,
    Tab: true,
  };

  function setMouse(e) {
    var rect = canvasEl
      ? canvasEl.getBoundingClientRect()
      : { left: 0, top: 0 };

    mouse.x = (e.clientX - rect.left);
    mouse.y = (e.clientY - rect.top);
  }

  function onKeyDown(e) {
    var code = e.code;

    // Teclas de digitação em campos de texto não fazem sentido aqui,
    // mas mantemos o default para não quebrar o navegador.
    if (blockDefault[code]) e.preventDefault();

    if (e.repeat) return;                 // ignora auto-repeat
    if (keys[code]) return;               // já estava segurada
    keys[code] = true;
    pressed[code] = true;
  }

  function onKeyUp(e) {
    delete keys[e.code];
  }

  function onMouseMove(e) { setMouse(e); }

  function onMouseDown(e) {
    setMouse(e);
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
    if (e.button === 2) {
      mouse.rightDown = true;
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) {
      mouse.down = false;
    }
    if (e.button === 2) {
      mouse.rightDown = false;
    }
  }

  function onBlur() {
    keys = Object.create(null);
    mouse.down = false;
    mouse.rightDown = false;
  }

  function onContextMenu(e) {
    // Botão direito não é usado no jogo
    if (canvasEl) e.preventDefault();
  }

  function init(canvas) {
    canvasEl = canvas || null;

    if (!mouse.x && !mouse.y) {
      mouse.x = (global.innerWidth || 800) / 2;
      mouse.y = (global.innerHeight || 600) / 2;
    }

    global.addEventListener('keydown', onKeyDown);
    global.addEventListener('keyup', onKeyUp);
    global.addEventListener('blur', onBlur);

    global.addEventListener('mousemove', onMouseMove);
    global.addEventListener('mousedown', onMouseDown);
    global.addEventListener('mouseup', onMouseUp);

    if (canvasEl) canvasEl.addEventListener('contextmenu', onContextMenu);

    return true;
  }

  MC.input = {
    init: init,

    /** Tecla está sendo segurada? */
    isDown: function (code) { return !!keys[code]; },

    /** Tecla foi pressionada neste frame? (edge-triggered) */
    justPressed: function (code) { return !!pressed[code]; },

    /** Qualquer tecla de gameplay pressionada neste frame? */
    anyJustPressed: function () {
      for (var k in pressed) if (pressed[k]) return true;
      return false;
    },

    getMouse: function () {
      return { x: mouse.x, y: mouse.y, down: mouse.down };
    },
    mouse: mouse,

    consumeClick: function () {
      var c = mouse.clicked;
      mouse.clicked = false;
      return c;
    },

    isMouseDown: function () { return mouse.down; },

    /** Vetor de movimento normalizado (0..1). */
    getMovementVector: function () {
      var dx = 0, dy = 0;
      if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

      var len = Math.hypot(dx, dy);
      if (len > 0) { dx /= len; dy /= len; }
      return { dx: dx, dy: dy, length: len > 0 ? 1 : 0 };
    },

    /** Limpa os estados de borda. Chamado ao final de cada frame. */
    endFrame: function () {
      pressed = Object.create(null);
    },

    setCursorVisible: function (visible) {
      if (canvasEl) canvasEl.classList.toggle('playing', !visible);
    },
  };

})(window);