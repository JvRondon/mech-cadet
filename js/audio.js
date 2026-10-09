/* ============================================
   MECH//CADET — Áudio (Web Audio API)
   Som 100% procedural: nenhum arquivo externo.
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});

  var ctx = null;
  var masterGain = null;
  var sfxGain = null;
  var musicGain = null;
  var ready = false;

  function ensureContext() {
    if (ctx) return true;

    var AudioCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtor) return false;

    try {
      ctx = new AudioCtor();
    } catch (e) {
      console.warn('[MECH//CADET] Áudio indisponível:', e);
      return false;
    }

    masterGain = ctx.createGain();
    masterGain.gain.value = MC.CONFIG.audio.master;
    masterGain.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = MC.CONFIG.audio.sfx;
    sfxGain.connect(masterGain);

    musicGain = ctx.createGain();
    musicGain.gain.value = MC.CONFIG.audio.music;
    musicGain.connect(masterGain);

    ready = true;
    return true;
  }

  function tone(opts) {
    if (!ensureContext()) return;

    if (ctx.state === 'suspended') ctx.resume();

    var t = ctx.currentTime + (opts.delay || 0);
    var dur = opts.duration || 0.1;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var dest = opts.bus === 'music' ? musicGain : sfxGain;

    osc.type = opts.type || 'square';

    if (opts.freqEnd) {
      osc.frequency.setValueAtTime(opts.freq, t);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, opts.freqEnd), t + dur
      );
    } else {
      osc.frequency.setValueAtTime(opts.freq, t);
    }

    var peak = opts.volume == null ? 0.12 : opts.volume;
    // Curva de ataque curta evita "clique" de comutação.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.012, dur * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(opts) {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume();

    var t = ctx.currentTime + (opts.delay || 0);
    var dur = opts.duration || 0.2;
    var frames = Math.floor(ctx.sampleRate * dur);
    var buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buffer.getChannelData(0);

    for (var i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    var src = ctx.createBufferSource();
    src.buffer = buffer;

    var filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.value = opts.freq || 900;

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.volume == null ? 0.15 : opts.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    src.start(t);
    src.stop(t + dur);
  }

  // Nota musical por nome — usado na música de fundo
  var NOTE = {
    C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81,
    F3: 174.61, G3: 196.00, Ab3: 207.65, Bb3: 233.08,
    C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63,
    F4: 349.23, G4: 392.00, Ab4: 415.30, Bb4: 466.16, C5: 523.25,
  };

  var music = {
    timer: null,
    playing: false,
    step: 0,
    // Progressão em Lá menor, instrumental e neutra
    progression: [
      [NOTE.A2 || 110.00, NOTE.C4, NOTE.E4, NOTE.G4],
      [NOTE.A2 || 110.00, NOTE.B3 || 246.94, NOTE.D4, NOTE.F4],
      [NOTE.F2 || 87.31, NOTE.A3 || 220.00, NOTE.C4, NOTE.E4],
      [NOTE.G2 || 98.00, NOTE.Bb3, NOTE.D4, NOTE.F4],
    ],
  };

  var audio = {
    unlock: function () {
      if (!ensureContext()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    },

    setMasterVolume: function (v) {
      if (masterGain) masterGain.gain.value = MC.clamp(v, 0, 1);
    },

    beep: function (freq, duration, type, volume) {
      tone({ freq: freq, duration: duration, type: type, volume: volume });
    },

    startMusic: function () {
      if (!ensureContext() || music.playing) return;
      music.playing = true;
      music.step = 0;

      music.timer = setInterval(function () {
        if (!music.playing || ctx.state !== 'running') return;

        var chord = music.progression[Math.floor(music.step / 4) % music.progression.length];

        // Baixo
        tone({
          freq: chord[0], duration: 0.42, type: 'sine',
          volume: 0.16, bus: 'music',
        });

        // Arpejo esparso
        if (music.step % 2 === 0) {
          tone({
            freq: chord[1 + (music.step % 3)], duration: 0.3, type: 'triangle',
            volume: 0.05, bus: 'music', delay: 0.02,
          });
        }
        if (music.step % 8 === 4) {
          tone({
            freq: chord[3], duration: 0.6, type: 'triangle',
            volume: 0.06, bus: 'music',
          });
        }

        music.step++;
      }, 300);
    },

    stopMusic: function () {
      music.playing = false;
      if (music.timer) {
        clearInterval(music.timer);
        music.timer = null;
      }
    },

    // ---------------- Sons do jogo ----------------
    SFX: {
      bootLine: function () {
        tone({ freq: 1400 + Math.random() * 300, duration: 0.03, type: 'square', volume: 0.035 });
      },

      bootOnline: function () {
        tone({ freq: 523.25, duration: 0.14, type: 'sine', volume: 0.14 });
        tone({ freq: 783.99, duration: 0.18, type: 'sine', volume: 0.12, delay: 0.1 });
        tone({ freq: 1046.5, duration: 0.3, type: 'sine', volume: 0.11, delay: 0.2 });
      },

      uiClick: function () {
        tone({ freq: 880, duration: 0.05, type: 'square', volume: 0.07 });
        tone({ freq: 1320, duration: 0.04, type: 'sine', volume: 0.05, delay: 0.03 });
      },

      uiHover: function () {
        tone({ freq: 1500, duration: 0.02, type: 'sine', volume: 0.025 });
      },

      dash: function () {
        tone({ freq: 260, freqEnd: 1400, duration: 0.18, type: 'sawtooth', volume: 0.11 });
        noise({ duration: 0.16, freq: 2600, volume: 0.06 });
      },

      pulse: function () {
        tone({ freq: 900, freqEnd: 1500, duration: 0.07, type: 'square', volume: 0.08 });
      },

      hit: function () {
        tone({ freq: 220, freqEnd: 120, duration: 0.07, type: 'square', volume: 0.07 });
      },

      enemyDown: function () {
        tone({ freq: 700, freqEnd: 180, duration: 0.16, type: 'sawtooth', volume: 0.1 });
        noise({ duration: 0.2, freq: 1400, volume: 0.07 });
      },

      damage: function () {
        tone({ freq: 180, freqEnd: 70, duration: 0.22, type: 'sawtooth', volume: 0.13 });
        noise({ duration: 0.18, freq: 700, volume: 0.09 });
      },

      collect: function () {
        tone({ freq: 1318.5, duration: 0.07, type: 'sine', volume: 0.09 });
        tone({ freq: 1760, duration: 0.1, type: 'sine', volume: 0.08, delay: 0.06 });
      },

      objective: function () {
        [523.25, 659.25, 783.99].forEach(function (f, i) {
          tone({ freq: f, duration: 0.16, type: 'sine', volume: 0.13, delay: i * 0.09 });
        });
      },

      overdrive: function () {
        tone({ freq: 120, freqEnd: 900, duration: 0.5, type: 'sawtooth', volume: 0.12 });
        tone({ freq: 60, freqEnd: 300, duration: 0.6, type: 'square', volume: 0.07 });
      },

      warning: function () {
        tone({ freq: 440, duration: 0.11, type: 'square', volume: 0.1 });
        tone({ freq: 440, duration: 0.11, type: 'square', volume: 0.1, delay: 0.19 });
      },

      victory: function () {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
          tone({ freq: f, duration: 0.32, type: 'sine', volume: 0.14, delay: i * 0.13 });
        });
      },

      defeat: function () {
        tone({ freq: 392, duration: 0.3, type: 'sawtooth', volume: 0.11 });
        tone({ freq: 311.13, duration: 0.3, type: 'sawtooth', volume: 0.11, delay: 0.22 });
        tone({ freq: 196, duration: 0.7, type: 'sawtooth', volume: 0.12, delay: 0.44 });
      },

      // ---------------- V2 ----------------

      xpPickup: function () {
        tone({ freq: 1760, freqEnd: 2400, duration: 0.045, type: 'sine', volume: 0.035 });
      },

      laser: function () {
        tone({ freq: 1800, freqEnd: 420, duration: 0.22, type: 'sawtooth', volume: 0.11 });
        tone({ freq: 900, freqEnd: 200, duration: 0.26, type: 'square', volume: 0.06, delay: 0.02 });
        noise({ duration: 0.18, freq: 3200, volume: 0.07 });
      },

      laserDenied: function () {
        tone({ freq: 220, duration: 0.06, type: 'square', volume: 0.045 });
      },

      powerUp: function () {
        [659.25, 987.77, 1318.5].forEach(function (f, i) {
          tone({ freq: f, duration: 0.13, type: 'triangle', volume: 0.1, delay: i * 0.05 });
        });
      },

      levelUp: function () {
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach(function (f, i) {
          tone({ freq: f, duration: 0.24, type: 'sine', volume: 0.12, delay: i * 0.075 });
        });
        tone({ freq: 261.63, duration: 0.6, type: 'triangle', volume: 0.08, delay: 0.1 });
      },

      enemySpawn: function () {
        tone({ freq: 320, freqEnd: 620, duration: 0.12, type: 'triangle', volume: 0.045 });
      },
    },
  };

  MC.audio = audio;

})(window);