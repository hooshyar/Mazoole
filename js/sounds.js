// Sound effects for every game, made on the fly with WebAudio: no audio files.
// js/game.js routes sfx() here (after your own recorded voices from js/voices.js,
// which always win). Some sounds take a { pan } so you can hear which side
// something is on: -1 is the left speaker, 1 the right.
(function () {
  let ctx = null, master = null, noiseBuf = null;

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (_) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor(); // keeps loud moments from crackling
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function dest(pan) {
    if (!pan || !ctx.createStereoPanner) return master;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(master);
    return p;
  }

  // One note. o: type, slide (end frequency), gain, attack, delay, pan, vib (depth Hz), vibRate, filter {type, f, q}
  function tone(f, dur, o) {
    o = o || {};
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || "triangle";
    osc.frequency.setValueAtTime(f, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    if (o.vib) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = o.vibRate || 6;
      lg.gain.value = o.vib;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    const v = o.gain == null ? 0.22 : o.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    if (o.filter) {
      const fl = c.createBiquadFilter();
      fl.type = o.filter.type || "lowpass";
      fl.frequency.value = o.filter.f;
      fl.Q.value = o.filter.q || 1;
      g.connect(fl).connect(dest(o.pan));
    } else g.connect(dest(o.pan));
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // A burst of noise through a filter, optionally sweeping from f to f2
  function noise(dur, o) {
    o = o || {};
    const c = ac();
    if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noiseBuf;
    fl.type = o.type || "bandpass";
    fl.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    fl.Q.value = o.q || 1;
    const v = o.gain == null ? 0.25 : o.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl).connect(g).connect(dest(o.pan));
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  const notes = (list, step, o) => list.forEach((f, i) => tone(f, (o && o.len) || 0.16, Object.assign({}, o, { delay: ((o && o.delay) || 0) + i * step })));
  const opt = (a) => (a && typeof a === "object" ? a : {});

  const S = {
    // ---- everywhere
    tap: () => { tone(1500, 0.035, { type: "sine", gain: 0.14 }); tone(950, 0.045, { type: "sine", gain: 0.1, delay: 0.015 }); },
    go: () => { tone(988, 0.09, { type: "square", gain: 0.08 }); tone(1319, 0.16, { type: "square", gain: 0.08, delay: 0.1 }); },

    // ---- mazes
    key: () => { notes([1319, 1568, 2093], 0.06, { type: "triangle", gain: 0.18, len: 0.18 }); noise(0.25, { type: "highpass", f: 6000, gain: 0.05, delay: 0.05 }); },
    star: () => { notes([880, 1109, 1319, 1760], 0.055, { gain: 0.16, len: 0.2 }); tone(2637, 0.4, { type: "sine", gain: 0.05, delay: 0.2 }); },
    button: () => { noise(0.05, { type: "lowpass", f: 900, gain: 0.25 }); tone(220, 0.12, { type: "square", slide: 160, gain: 0.08, filter: { f: 1200 } }); },
    unpress: () => tone(520, 0.14, { type: "square", slide: 260, gain: 0.07, filter: { f: 1500 } }),
    unlock: () => { tone(150, 0.45, { type: "sawtooth", slide: 95, gain: 0.12, vib: 18, vibRate: 22, filter: { f: 900 } }); noise(0.06, { type: "lowpass", f: 1200, gain: 0.2, delay: 0.42 }); },
    wings: () => { noise(0.5, { f: 400, f2: 2600, q: 0.8, gain: 0.18 }); tone(500, 0.5, { type: "sine", slide: 1500, gain: 0.08 }); },
    hurt: () => { tone(320, 0.25, { type: "square", slide: 70, gain: 0.12, filter: { f: 1400 } }); noise(0.12, { type: "lowpass", f: 500, gain: 0.3 }); },
    win: () => {
      notes([523, 659, 784, 1047], 0.13, { gain: 0.18, len: 0.22 });
      tone(784, 0.5, { gain: 0.14, delay: 0.55 }); tone(1047, 0.6, { gain: 0.16, delay: 0.55 }); tone(1319, 0.6, { type: "sine", gain: 0.08, delay: 0.55 });
    },
    lose: () => [[392, 370], [370, 349], [349, 330], [330, 247]].forEach(([a, b], i) =>
      tone(a, i === 3 ? 0.9 : 0.34, { type: "sawtooth", slide: b, gain: 0.1, delay: i * 0.36, vib: i === 3 ? 8 : 0, filter: { f: 1100 } })),
    candy: (a) => { const n = typeof a === "number" ? a : 1; tone(600 + n * 140, 0.08, { type: "sine", slide: 900 + n * 200, gain: 0.16 }); noise(0.03, { type: "highpass", f: 3000, gain: 0.08 }); },
    portal: () => { tone(220, 0.45, { type: "sine", slide: 1300, gain: 0.14, vib: 40, vibRate: 14 }); tone(1300, 0.3, { type: "sine", slide: 400, gain: 0.06, delay: 0.3 }); },
    slide: () => noise(0.22, { type: "highpass", f: 2500, f2: 5000, gain: 0.08 }),
    medal: () => { tone(1175, 0.7, { type: "sine", gain: 0.16 }); tone(2350, 0.5, { type: "sine", gain: 0.05 }); },
    sticker: () => { notes([784, 988, 1175, 1568], 0.08, { gain: 0.14, len: 0.18 }); tone(2093, 0.6, { type: "sine", gain: 0.06, delay: 0.32 }); },

    // ---- treasure hunts
    sparkle: () => {
      notes([1047, 1319, 1568, 2093, 2637], 0.05, { gain: 0.13, len: 0.25 });
      noise(0.5, { type: "highpass", f: 7000, gain: 0.05, delay: 0.1 });
      tone(523, 0.35, { gain: 0.1 });
    },
    whoosh: () => noise(0.35, { f: 700, f2: 3200, q: 1.2, gain: 0.18 }),
    bag: () => { tone(760, 0.12, { type: "sine", slide: 280, gain: 0.2 }); tone(1200, 0.06, { type: "sine", gain: 0.06, delay: 0.1 }); },
    tick: (a) => tone(800 + clamp(+a || 0, 0, 1) * 1000, 0.05, { type: "sine", gain: 0.09 }),
    ping: (a) => { const o = opt(a), f = 600 + clamp(o.near || 0, 0, 1) * 900; tone(f, 0.35, { type: "sine", gain: 0.12, pan: o.pan }); tone(f * 2, 0.2, { type: "sine", gain: 0.03, pan: o.pan }); },
    boo: () => { tone(330, 0.75, { type: "sine", slide: 180, gain: 0.16, vib: 25, vibRate: 7 }); noise(0.6, { f: 500, q: 2, gain: 0.06 }); },
    fanfare: () => {
      notes([523, 523, 523, 659, 784], 0.12, { type: "square", gain: 0.07, len: 0.14, delay: 0 });
      notes([659, 784, 1047], 0.16, { gain: 0.16, len: 0.3, delay: 0.62 });
      tone(1319, 0.9, { type: "sine", gain: 0.1, delay: 1.1 });
      noise(0.8, { type: "highpass", f: 7000, gain: 0.05, delay: 1.1 });
    },
    power: () => notes([660, 990, 1320, 1980], 0.04, { type: "sine", gain: 0.12, len: 0.15 }),

    // ---- Quack Hunt
    shoot: () => { noise(0.14, { type: "lowpass", f: 4000, f2: 300, gain: 0.45 }); tone(140, 0.16, { type: "sine", slide: 45, gain: 0.3 }); },
    quack: (a) => {
      const o = opt(a), v = o.soft ? 0.2 : 0.45; // the bandpass makes it quiet, so start louder
      for (let i = 0; i < 2; i++) tone(500 - i * 30, 0.11, { type: "sawtooth", slide: 340, gain: v, delay: i * 0.15, pan: o.pan, filter: { type: "bandpass", f: 1100, q: 4 } });
    },
    flap: (a) => { const o = opt(a); for (let i = 0; i < 4; i++) noise(0.06, { type: "lowpass", f: 900, gain: 0.12, delay: i * 0.08, pan: o.pan }); },
    fall: () => tone(1400, 0.75, { type: "sine", slide: 260, gain: 0.1, vib: 12, vibRate: 9, delay: 0.1 }),
    flyaway: () => { tone(500, 0.6, { type: "sine", slide: 1600, gain: 0.12, vib: 20, vibRate: 10 }); S.flap(); },
    empty: () => { tone(2200, 0.02, { type: "square", gain: 0.05 }); tone(150, 0.04, { type: "square", gain: 0.06, delay: 0.02 }); },
    lock: () => tone(1800, 0.04, { type: "sine", gain: 0.07 }),
    secret: () => { notes([523, 659, 784, 1047, 1319, 1568], 0.07, { type: "sine", gain: 0.13, len: 0.35 }); noise(0.9, { type: "highpass", f: 6500, gain: 0.05, delay: 0.25 }); },
  };

  function play(name, arg) {
    const fn = S[name];
    if (!fn) return false;
    if (!ac()) return false;
    try { fn(arg); } catch (_) { return false; }
    return true;
  }

  // A soft click for every button (not the game pads, and not Shoot, which has its own sound)
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest && e.target.closest("button, .filebtn");
    if (!b || b.closest(".dpad") || b.id === "duck-shoot") return;
    const M = window.Mazoole;
    if (M && M.G && !M.G.sound) return;
    play("tap");
  }, true);

  window.MazooleSounds = { play, names: Object.keys(S) };
})();
