// Mazoole: a co-op maze game made from hand-drawn mazes.
(function () {
  const P = window.Pencil;

  // ------------------------------------------------------------ tuning knobs
  const SPEED = 5.5;          // player tiles per second
  const WINGS_TIME = 6;       // seconds of flying per wings pickup
  const HEARTS = 5;           // shared hearts per level
  const INVULN = 1.5;         // seconds of blinking after getting hurt
  const BEAM = { charge: 1.2, fire: 1.1, cycle: 4.2 };
  const MONSTER_SPEED = { m: 2.2, s: 1.6 };

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYMAP = [
    { KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" },
    { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" },
  ];

  // ------------------------------------------------------------ level parsing
  function parse(def) {
    const grid = def.map.map((row) => row.split(""));
    const h = grid.length, w = grid[0].length;
    const world = {
      def, w, h, grid, starts: [], monsters: [], turrets: [], starsTotal: 0,
      pressed: new Set(), keys: 0, stars: 0, hearts: HEARTS, dirty: true,
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = grid[y][x];
      if (c === "1" || c === "2") { world.starts[+c - 1] = [x, y]; grid[y][x] = "."; }
      else if (c === "m" || c === "s") {
        world.monsters.push({ kind: c, x, y, sx: x, sy: y, dx: 0, dy: 0, prog: 0, id: world.monsters.length });
        grid[y][x] = ".";
      } else if (c === "*") world.starsTotal++;
      else if (c === "F") world.turrets.push({ x, y, dx: 0, dy: 0, offset: world.turrets.length * 1.4, cells: [], state: "idle" });
    }
    if (!world.starts[0]) world.starts[0] = findFloor(world);
    if (!world.starts[1]) world.starts[1] = world.starts[0];

    // monsters walk left-right, spiders go up-down on their thread
    // (each falls back to the other direction if there's no room)
    for (const m of world.monsters) {
      const run = (dx, dy) => { let n = 0; while (monsterFree(world, m.x + dx * (n + 1), m.y + dy * (n + 1))) n++; return n; };
      const hor = run(1, 0) + run(-1, 0), ver = run(0, 1) + run(0, -1);
      const vertical = m.kind === "s" ? ver > 0 : hor === 0 && ver > 0;
      if (vertical) { m.dy = run(0, 1) ? 1 : -1; m.top = m.y - run(0, -1); }
      else if (hor > 0) m.dx = run(1, 0) ? 1 : -1;
    }
    // the angry fairy shoots down her longest corridor
    for (const f of world.turrets) {
      let best = -1;
      for (const [dx, dy] of Object.values(DIRS)) {
        let n = 0;
        while (inside(world, f.x + dx * (n + 1), f.y + dy * (n + 1)) && world.grid[f.y + dy * (n + 1)][f.x + dx * (n + 1)] !== "#") n++;
        if (n > best) { best = n; f.dx = dx; f.dy = dy; }
      }
    }
    return world;
  }

  function findFloor(world) {
    for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) if (world.grid[y][x] === ".") return [x, y];
    return [1, 1];
  }
  const inside = (world, x, y) => x >= 0 && y >= 0 && x < world.w && y < world.h;
  const border = (world, x, y) => x <= 0 || y <= 0 || x >= world.w - 1 || y >= world.h - 1;
  const isDoor = (c) => c >= "A" && c <= "C";
  const isButton = (c) => c >= "a" && c <= "c";

  // Can something that walks on the ground stand here?
  function walkable(world, x, y) {
    if (!inside(world, x, y)) return false;
    const c = world.grid[y][x];
    if (c === "#" || c === "F" || c === "L") return false;
    if (isDoor(c)) return world.pressed.has(c.toLowerCase());
    return true;
  }
  function monsterFree(world, x, y) {
    return walkable(world, x, y) && world.grid[y][x] !== "G";
  }
  function playerCanEnter(world, p, x, y) {
    if (border(world, x, y)) return false;
    if (p.flyT > 0) return true;
    if (world.grid[y][x] === "L") return world.keys > 0;
    return walkable(world, x, y);
  }

  // ------------------------------------------------------------ game state
  const G = {
    mode: "menu", players: 2, levelIndex: 0, customDef: null, world: null,
    t: 0, particles: [], sound: true, touchDir: [null, null],
  };
  let canvas, ctx, staticCanvas, staticCtx, tile = 32, dpr = 1;

  function makePlayer(i, start) {
    return { id: i, x: start[0], y: start[1], fx: start[0], fy: start[1], sx: start[0], sy: start[1], tx: 0, ty: 0,
      moving: false, facing: 1, flyT: 0, inv: 0, hurtT: 0 };
  }

  function startLevel(def) {
    G.world = parse(def);
    G.world.playersList = [];
    for (let i = 0; i < G.players; i++) G.world.playersList.push(makePlayer(i, G.world.starts[i]));
    G.particles = [];
    G.mode = "intro";
    document.body.classList.remove("in-menu", "editing");
    resize();
    UI.showIntro(def);
    UI.updateHud();
  }

  function currentDef() {
    return G.customDef || window.MAZOOLE_LEVELS[G.levelIndex];
  }

  // ------------------------------------------------------------ input
  const held = new Map(); // key code -> press order
  let pressCounter = 0;

  function dirFor(i) {
    if (G.touchDir[i]) return G.touchDir[i];
    const maps = G.players === 1 ? [KEYMAP[0], KEYMAP[1]] : [KEYMAP[i]];
    let best = null, bestOrder = -1;
    for (const m of maps) for (const code in m) {
      const o = held.get(code);
      if (o != null && o > bestOrder) { bestOrder = o; best = m[code]; }
    }
    return best;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    if (!held.has(e.code)) held.set(e.code, ++pressCounter);
    if (G.mode === "intro" && (e.code === "Enter" || e.code === "Space")) UI.go();
    else if (G.mode === "won" && (e.code === "Enter" || e.code === "Space")) UI.next();
    else if (G.mode === "lost" && (e.code === "Enter" || e.code === "Space")) startLevel(currentDef());
    else if (G.mode === "play" && e.code === "KeyR") startLevel(currentDef());
    else if (e.code === "Escape" && G.mode !== "menu") UI.menu();
  });
  window.addEventListener("keyup", (e) => held.delete(e.code));
  window.addEventListener("blur", () => held.clear());

  // ------------------------------------------------------------ sound (tiny beeps)
  let actx = null;
  function beep(freq, dur, type, slide) {
    if (!G.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "triangle";
      o.frequency.setValueAtTime(freq, actx.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, actx.currentTime + dur);
      g.gain.setValueAtTime(0.15, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.connect(g).connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (_) { /* no audio, no problem */ }
  }
  const SFX = {
    step: () => {},
    key: () => { beep(880, 0.12); setTimeout(() => beep(1320, 0.15), 90); },
    star: () => { beep(1046, 0.1); setTimeout(() => beep(1568, 0.18), 70); },
    button: () => beep(330, 0.25, "square", 660),
    unlock: () => beep(520, 0.3, "sawtooth", 1040),
    wings: () => beep(400, 0.5, "sine", 1600),
    hurt: () => beep(300, 0.35, "sawtooth", 80),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.25), i * 140)),
    lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.3), i * 180)),
  };

  // ------------------------------------------------------------ update
  function update(dt) {
    const W = G.world;
    G.t += dt;
    for (const p of G.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 3 * dt; p.life -= dt; }
    G.particles = G.particles.filter((p) => p.life > 0);
    if (G.mode !== "play") return;

    for (const p of W.playersList) updatePlayer(W, p, dt);
    for (const m of W.monsters) updateMonster(W, m, dt);
    for (const f of W.turrets) updateTurret(W, f);

    // collisions
    for (const p of W.playersList) {
      if (p.inv > 0) continue;
      const grounded = p.flyT <= 0;
      if (grounded) for (const m of W.monsters) {
        if (Math.hypot(m.fx - p.fx, m.fy - p.fy) < 0.62) { hurt(W, p, m.kind); break; }
      }
      if (p.inv > 0) continue;
      const px = Math.round(p.fx), py = Math.round(p.fy);
      for (const f of W.turrets) {
        if (f.state === "fire" && f.cells.some((c) => c[0] === px && c[1] === py)) { hurt(W, p, "beam"); break; }
      }
    }
  }

  function updatePlayer(W, p, dt) {
    if (p.inv > 0) p.inv -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.flyT > 0) {
      p.flyT -= dt;
      if (p.flyT <= 0 && p.moving && !walkable(W, p.x, p.y)) p.flyT = 0.01; // finish the hop, then land
      else if (p.flyT <= 0) {
        if (!walkable(W, p.x, p.y)) land(W, p);
        if (trapped(W, p)) { // landed in a sealed room: float back to the wings
          p.x = p.fx = p.wx; p.y = p.fy = p.wy; burst(p.x, p.y, "#c9a6ff");
        }
      }
    }
    if (!p.moving) {
      const d = dirFor(p.id);
      if (d) {
        const [dx, dy] = DIRS[d];
        if (dx) p.facing = dx;
        const nx = p.x + dx, ny = p.y + dy;
        if (playerCanEnter(W, p, nx, ny)) {
          if (W.grid[ny][nx] === "L" && p.flyT <= 0) {
            W.keys--; W.grid[ny][nx] = "."; W.dirty = true; SFX.unlock(); burst(nx, ny, "#f5d33b"); UI.updateHud();
          }
          p.tx = nx; p.ty = ny; p.moving = true;
        }
      }
    }
    if (p.moving) {
      const step = SPEED * dt;
      const ddx = p.tx - p.fx, ddy = p.ty - p.fy;
      const dist = Math.hypot(ddx, ddy);
      if (dist <= step) {
        p.fx = p.x = p.tx; p.fy = p.y = p.ty; p.moving = false;
        enterTile(W, p);
      } else { p.fx += (ddx / dist) * step; p.fy += (ddy / dist) * step; }
    }
  }

  function land(W, p) {
    // wings ran out above a wall: float down to the nearest floor
    const seen = new Set([p.x + "," + p.y]);
    const q = [[p.x, p.y]];
    while (q.length) {
      const [x, y] = q.shift();
      if (walkable(W, x, y)) { p.x = p.fx = x; p.y = p.fy = y; burst(x, y, "#9ad0f5"); return; }
      for (const [dx, dy] of Object.values(DIRS)) {
        const k = x + dx + "," + (y + dy);
        if (inside(W, x + dx, y + dy) && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]); }
      }
    }
  }

  // Is the player shut in, with no way to ever reach the goal or more wings?
  function trapped(W, p) {
    const seen = new Set([p.x + "," + p.y]), q = [[p.x, p.y]];
    while (q.length) {
      const [x, y] = q.shift(), c = W.grid[y][x];
      if (c === "G" || c === "w") return false;
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx, ny = y + dy, k = nx + "," + ny;
        if (!inside(W, nx, ny) || seen.has(k) || W.grid[ny][nx] === "#" || W.grid[ny][nx] === "F") continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return true;
  }

  function enterTile(W, p) {
    const c = W.grid[p.y][p.x];
    if (c === "k") { W.keys++; W.grid[p.y][p.x] = "."; SFX.key(); burst(p.x, p.y, "#f5d33b"); }
    else if (c === "*") { W.stars++; W.grid[p.y][p.x] = "."; SFX.star(); burst(p.x, p.y, "#ffc93c"); }
    else if (c === "w") { if (p.flyT <= 0) SFX.wings(); p.flyT = WINGS_TIME; p.wx = p.x; p.wy = p.y; burst(p.x, p.y, "#c9a6ff"); }
    else if (isButton(c) && !W.pressed.has(c)) { W.pressed.add(c); W.dirty = true; SFX.button(); burst(p.x, p.y, P.DOOR_COLORS[c]); }
    else if (c === "h" && p.flyT <= 0) hurt(W, p, "trap");
    else if (c === "G") return win(W);
    UI.updateHud();
  }

  function updateMonster(W, m, dt) {
    if (!m.dx && !m.dy) { m.fx = m.x; m.fy = m.y; return; }
    if (!monsterFree(W, m.x + m.dx, m.y + m.dy) && m.prog === 0) { m.dx *= -1; m.dy *= -1; }
    if (monsterFree(W, m.x + m.dx, m.y + m.dy)) {
      m.prog += MONSTER_SPEED[m.kind] * dt;
      while (m.prog >= 1) {
        m.prog -= 1; m.x += m.dx; m.y += m.dy;
        if (!monsterFree(W, m.x + m.dx, m.y + m.dy)) { m.dx *= -1; m.dy *= -1; m.prog = 0; }
      }
    }
    m.fx = m.x + m.dx * m.prog;
    m.fy = m.y + m.dy * m.prog;
  }

  function updateTurret(W, f) {
    const ph = (G.t + f.offset) % BEAM.cycle;
    f.state = ph < BEAM.charge ? "charge" : ph < BEAM.charge + BEAM.fire ? "fire" : "idle";
    f.cells = [];
    let x = f.x + f.dx, y = f.y + f.dy;
    while (inside(W, x, y)) {
      const c = W.grid[y][x];
      if (c === "#" || c === "F" || c === "L" || (isDoor(c) && !W.pressed.has(c.toLowerCase()))) break;
      f.cells.push([x, y]);
      x += f.dx; y += f.dy;
    }
  }

  function hurt(W, p, why) {
    if (p.inv > 0 || G.mode !== "play") return;
    G.lastHurt = { why, x: p.x, y: p.y };
    W.hearts--;
    SFX.hurt();
    burst(p.x, p.y, "#b5405a");
    p.hurtT = 0.6;
    p.inv = INVULN;
    p.flyT = 0;
    p.moving = false;
    p.x = p.fx = p.sx; p.y = p.fy = p.sy;
    UI.updateHud();
    if (W.hearts <= 0) { G.mode = "lost"; SFX.lose(); UI.showLost(); }
  }

  function win(W) {
    G.mode = "won";
    W.won = true;
    SFX.win();
    const gy = W.grid.findIndex((r) => r.includes("G")), gx = W.grid[gy].indexOf("G");
    for (let i = 0; i < 40; i++) burst(gx, gy, ["#e5484d", "#f5d33b", "#3e7bfa", "#2fae62", "#ff8fc1"][i % 5], 1);
    UI.updateHud();
    setTimeout(() => UI.showWon(W), 900);
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < (n || 8); i++) {
      const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3;
      G.particles.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 0.8 + Math.random() * 0.6, color });
    }
  }

  // ------------------------------------------------------------ rendering
  function resize() {
    if (!G.world) return;
    const stage = document.getElementById("stage");
    const W = G.world;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    tile = Math.max(12, Math.floor(Math.min(stage.clientWidth / W.w, stage.clientHeight / W.h)));
    canvas.style.width = tile * W.w + "px";
    canvas.style.height = tile * W.h + "px";
    canvas.width = staticCanvas.width = Math.round(tile * W.w * dpr);
    canvas.height = staticCanvas.height = Math.round(tile * W.h * dpr);
    W.dirty = true;
  }

  function drawStatic(W, s, target) {
    const sctx = target || staticCtx;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    P.paper(sctx, W.w * s, W.h * s, s);
    P.walls(sctx, W.grid, (c) => c === "#", s);
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
      const c = W.grid[y][x], seed = P.hash(x, y, 5);
      if (isDoor(c)) P.door(sctx, x, y, s, c.toLowerCase(), W.pressed.has(c.toLowerCase()), seed);
      else if (c === "L") P.lockDoor(sctx, x, y, s, seed);
      else if (isButton(c)) P.button(sctx, x, y, s, c, W.pressed.has(c), seed);
    }
    W.dirty = false;
  }

  function renderWorld(W, c, s, t, opts) {
    opts = opts || {};
    c.drawImage(opts.staticCanvas || staticCanvas, 0, 0, W.w * s, W.h * s);
    const r = P.rng(P.hash(Math.floor(t * 6), 3, 3));
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
      const ch = W.grid[y][x], cx = x * s + s / 2, cy = y * s + s / 2;
      const bob = Math.sin(t * 3 + x + y) * s * 0.05;
      if (ch === "k") P.key(c, cx, cy + bob, s, r);
      else if (ch === "*") P.star(c, cx, cy + bob, s * 0.3, r);
      else if (ch === "w") { c.save(); c.globalAlpha = 0.9; P.wingsShape(c, cx, cy + bob, s * 1.1, r, "rgba(200,170,255,0.8)", Math.sin(t * 4)); c.restore(); }
      else if (ch === "h") P.heartTrap(c, x, y, s, t, P.hash(x, y, 9));
      else if (ch === "G") {
        if (W.def.goal === "friend") P.friendInBed(c, cx, cy, s, t, W.won);
        else P.gift(c, cx, cy, s, P.rng(P.hash(x, y, 4)), W.won);
      }
    }
    for (const f of W.turrets) {
      if (f.state === "fire") P.beam(c, f.cells, s, t, f.dx, f.dy);
      else if (f.state === "charge" && f.cells.length) {
        // dotted warning line: the beam is coming!
        const a = f.cells[0], b = f.cells[f.cells.length - 1];
        c.save(); c.setLineDash([s * 0.1, s * 0.15]); c.strokeStyle = "#ff9f1c"; c.lineWidth = 2; c.globalAlpha = 0.8;
        c.beginPath(); c.moveTo(a[0] * s + s / 2, a[1] * s + s / 2); c.lineTo(b[0] * s + s / 2, b[1] * s + s / 2); c.stroke(); c.restore();
      }
      P.angryFairy(c, f.x * s + s / 2, f.y * s + s / 2, s, t, f.state === "charge");
    }
    for (const m of W.monsters) {
      const fx = m.fx == null ? m.x : m.fx, fy = m.fy == null ? m.y : m.fy;
      if (m.top != null) P.stroke(c, [[m.x * s + s / 2, m.top * s], [fx * s + s / 2, fy * s + s / 2]], P.rng(m.id + 1), 0, 1, P.INK, 0.5);
      (m.kind === "s" ? P.spider : P.monster)(c, fx * s + s / 2, fy * s + s / 2, s, t, m.id);
    }
    const players = W.playersList || [];
    for (const p of players) {
      if (p.inv > 0 && Math.floor(t * 12) % 2) continue;
      const o = { moving: p.moving, facing: p.facing, flying: p.flyT > 0, hurt: p.hurtT > 0 };
      (p.id === 0 ? P.hero : P.fairy)(c, p.fx * s + s / 2, p.fy * s + s / 2, s, t, o);
      if (p.flyT > 0) {
        c.save();
        c.strokeStyle = p.flyT < 1.5 ? "#e5484d" : "#7a5cff";
        c.lineWidth = 3;
        c.globalAlpha = 0.7;
        c.beginPath();
        c.arc(p.fx * s + s / 2, p.fy * s + s * 0.05, s * 0.5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.flyT) / WINGS_TIME);
        c.stroke();
        c.restore();
      }
    }
    for (const p of G.particles) {
      c.save(); c.globalAlpha = Math.min(1, p.life);
      P.star(c, p.x * s, p.y * s, s * 0.1, r, p.color);
      c.restore();
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
    frame.last = now;
    if (G.mode === "edit") { window.MazooleEditor && window.MazooleEditor.render(dt); }
    else if (G.world) {
      update(dt);
      if (G.world.dirty) drawStatic(G.world, tile);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderWorld(G.world, ctx, tile, G.t);
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ UI glue
  const $ = (id) => document.getElementById(id);
  function icon(draw, size) {
    const c = document.createElement("canvas");
    size = size || 30;
    c.width = c.height = size * 2;
    c.style.width = c.style.height = size + "px";
    const x = c.getContext("2d");
    x.scale(2, 2);
    draw(x, size);
    return c;
  }

  const UI = {
    show(id) {
      for (const el of document.querySelectorAll(".screen")) el.hidden = el.id !== id;
    },
    menu() {
      G.mode = "menu";
      G.customDef = null;
      document.body.classList.remove("editing");
      document.body.classList.add("in-menu");
      $("hud-name").textContent = "Mazoole";
      UI.buildMenu();
      UI.show("menu");
      resize();
    },
    buildMenu() {
      const list = $("level-list");
      list.innerHTML = "";
      window.MAZOOLE_LEVELS.forEach((lv, i) => {
        const b = document.createElement("button");
        b.className = "card";
        b.innerHTML = `<b>${i + 1}. ${lv.name}</b><span>${lv.story}</span>`;
        b.onclick = () => { G.levelIndex = i; G.customDef = null; startLevel(lv); };
        list.appendChild(b);
      });
      const saved = window.MazooleEditor && window.MazooleEditor.load();
      if (saved) {
        const b = document.createElement("button");
        b.className = "card mine";
        b.innerHTML = `<b>★ ${saved.name}</b><span>The maze you drew yourself!</span>`;
        b.onclick = () => UI.playCustom(saved);
        list.appendChild(b);
      }
      document.querySelectorAll("[data-players]").forEach((b) => b.classList.toggle("on", +b.dataset.players === G.players));
      $("touch").classList.toggle("two", G.players === 2);
    },
    playCustom(def) {
      G.customDef = def;
      startLevel(def);
    },
    showIntro(def) {
      $("intro-title").textContent = def.name;
      $("intro-story").textContent = def.story || "";
      $("intro-controls").innerHTML = G.players === 2
        ? "<b>Hero</b>: W A S D &nbsp;·&nbsp; <b>Fairy</b>: arrow keys"
        : "Move with arrow keys or W A S D";
      UI.show("intro");
    },
    go() {
      if (G.mode !== "intro") return;
      G.mode = "play";
      UI.show(null);
    },
    showWon(W) {
      $("won-stars").textContent = W.starsTotal ? `Stars: ${W.stars} / ${W.starsTotal}` : "";
      $("won-title").textContent = W.def.goal === "friend" ? "You rescued your friend!" : "You found the gift!";
      const last = G.customDef || G.levelIndex >= window.MAZOOLE_LEVELS.length - 1;
      $("btn-next").textContent = last ? "Back to menu" : "Next maze →";
      document.querySelector("#won .btn-menu").hidden = last && !(G.customDef && G.customDef.fromEditor);
      if (G.customDef && G.customDef.fromEditor) $("btn-next").textContent = "Back to drawing ✏️";
      UI.show("won");
    },
    next() {
      if (G.customDef && G.customDef.fromEditor) return window.MazooleEditor.open();
      if (G.customDef || G.levelIndex >= window.MAZOOLE_LEVELS.length - 1) return UI.menu();
      G.levelIndex++;
      startLevel(currentDef());
    },
    showLost() { UI.show("lost"); },
    updateHud() {
      const W = G.world;
      if (!W) return;
      $("hud-name").textContent = W.def.name;
      $("hud-hearts").textContent = "♥".repeat(Math.max(0, W.hearts)) + "♡".repeat(Math.max(0, HEARTS - W.hearts));
      $("hud-keys").textContent = W.keys;
      $("hud-stars").textContent = `${W.stars}/${W.starsTotal}`;
    },
  };

  function initTouch() {
    const touchy = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    document.body.classList.toggle("touch", touchy);
    for (const pad of document.querySelectorAll(".dpad")) {
      const player = +pad.dataset.player;
      for (const b of pad.querySelectorAll("button")) {
        const set = (e) => { e.preventDefault(); G.touchDir[player] = b.dataset.dir; };
        const clear = (e) => { e.preventDefault(); if (G.touchDir[player] === b.dataset.dir) G.touchDir[player] = null; };
        b.addEventListener("pointerdown", set);
        b.addEventListener("pointerenter", (e) => { if (e.buttons) set(e); });
        b.addEventListener("pointerup", clear);
        b.addEventListener("pointerleave", clear);
        b.addEventListener("pointercancel", clear);
      }
    }
  }

  function init() {
    canvas = $("game");
    ctx = canvas.getContext("2d");
    staticCanvas = document.createElement("canvas");
    staticCtx = staticCanvas.getContext("2d");

    $("hud-key-icon").appendChild(icon((c, s) => P.key(c, s / 2, s / 2, s * 0.9, P.rng(1)), 26));
    $("hud-star-icon").appendChild(icon((c, s) => P.star(c, s / 2, s / 2, s * 0.4, P.rng(2)), 26));
    $("pick-1").prepend(icon((c, s) => P.hero(c, s / 2, s * 0.55, s * 0.9, 0, {}), 64));
    const two = icon((c, s) => { P.hero(c, s * 0.3, s * 0.55, s * 0.6, 0, {}); P.fairy(c, s * 0.72, s * 0.55, s * 0.6, 0, {}); }, 64);
    $("pick-2").prepend(two);

    document.querySelectorAll("[data-players]").forEach((b) => b.addEventListener("click", () => {
      G.players = +b.dataset.players;
      UI.buildMenu();
    }));
    $("btn-go").onclick = UI.go;
    $("btn-next").onclick = UI.next;
    $("btn-again").onclick = () => startLevel(currentDef());
    $("btn-retry").onclick = () => startLevel(currentDef());
    document.querySelectorAll(".btn-menu").forEach((b) => (b.onclick = UI.menu));
    $("btn-restart").onclick = () => G.world && G.mode !== "menu" && startLevel(currentDef());
    $("btn-sound").onclick = () => { G.sound = !G.sound; $("btn-sound").textContent = G.sound ? "♪ on" : "♪ off"; };
    $("btn-draw").onclick = () => window.MazooleEditor.open();
    window.addEventListener("resize", () => { resize(); window.MazooleEditor && window.MazooleEditor.resize(); });

    initTouch();
    UI.menu();
    // show level 1 behind the menu so the page looks alive
    G.world = parse(window.MAZOOLE_LEVELS[0]);
    G.world.playersList = [];
    resize();
    requestAnimationFrame(frame);
  }

  window.Mazoole = { G, UI, parse, renderWorld, drawStatic, startLevel, resize: () => resize(), get dpr() { return dpr; } };
  window.addEventListener("DOMContentLoaded", init);
})();
