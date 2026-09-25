// Mazoole: a co-op maze game made from hand-drawn mazes.
(function () {
  const P = window.Pencil;

  // ------------------------------------------------------------ tuning knobs
  const SPEED = 5.5;          // player tiles per second
  const WINGS_TIME = 6;       // seconds of flying per wings pickup
  const HEARTS = 5;           // shared hearts per level
  const INVULN = 1.5;         // seconds of blinking after getting hurt
  const BEAM = { charge: 1.2, fire: 1.1, cycle: 4.2 };
  const MONSTER_SPEED = { m: 2.2, s: 1.6, g: 1.8 };
  const GHOST_SIGHT = 9;      // the ghost only chases you when you are this close (in steps)
  const SLIDE_SPEED = 8.5;    // ice is fast!
  const POINTS = { candy: 10, star: 100, key: 25, button: 25, wings: 15, unlock: 25 };

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYMAP = [
    { KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" },
    { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" },
  ];

  // ------------------------------------------------------------ level parsing
  const photoCache = new Map();
  function parse(def) {
    const grid = def.map.map((row) => row.split(""));
    const h = grid.length, w = grid[0].length;
    const world = {
      def, w, h, grid, starts: [], monsters: [], turrets: [], starsTotal: 0,
      pressed: new Set(), held: false, keys: 0, stars: 0, hearts: HEARTS, dirty: true,
      portals: {}, candyTotal: 0, candy: 0, score: 0, time: 0, hurts: 0, caught: 0, combo: 0, lastCandy: -9,
    };
    if (def.photo) { // a photo of the drawing, shown faintly under the maze
      let img = photoCache.get(def.photo);
      if (!img) { img = new Image(); img.src = def.photo; photoCache.set(def.photo, img); }
      world.photoImg = img;
      if (!img.complete) img.addEventListener("load", () => (world.dirty = true), { once: true });
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = grid[y][x];
      if (c === "1" || c === "2") { world.starts[+c - 1] = [x, y]; grid[y][x] = "."; }
      else if (c === "m" || c === "s" || c === "g") {
        world.monsters.push({ kind: c, x, y, sx: x, sy: y, dx: 0, dy: 0, prog: 0, id: world.monsters.length });
        grid[y][x] = ".";
      } else if (c === "*") world.starsTotal++;
      else if (c === "+") world.candyTotal++;
      else if (c >= "3" && c <= "9") (world.portals[c] = world.portals[c] || []).push([x, y]);
      else if (c === "F") world.turrets.push({ x, y, dx: 0, dy: 0, offset: world.turrets.length * 1.4, cells: [], state: "idle" });
    }
    if (!world.starts[0]) world.starts[0] = findFloor(world);
    if (!world.starts[1]) world.starts[1] = world.starts[0];

    // monsters walk left-right, spiders go up-down on their thread
    // (each falls back to the other direction if there's no room)
    for (const m of world.monsters) {
      if (m.kind === "g") { m.wait = 3; continue; } // ghosts chase instead of patrolling (after a head start)
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
    world.par = def.par || estimatePar(world);
    return world;
  }

  // Seconds to beat for the clock medal: a relaxed walk to the goal and back-tracking time
  function estimatePar(world) {
    const s = world.starts[0], seen = new Map([[s + "", 0]]), q = [s];
    let d = 0;
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      if (world.grid[y][x] === "G") { d = seen.get(q[i] + ""); break; }
      for (const [dx, dy] of Object.values(DIRS)) {
        const n = [x + dx, y + dy], c = inside(world, n[0], n[1]) && world.grid[n[1]][n[0]];
        if (!c || c === "#" || c === "F" || seen.has(n + "")) continue;
        seen.set(n + "", seen.get(q[i] + "") + 1); q.push(n);
      }
    }
    return Math.max(20, Math.round((d / SPEED) * 3 + 15));
  }

  function findFloor(world) {
    for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) if (world.grid[y][x] === ".") return [x, y];
    return [1, 1];
  }
  const inside = (world, x, y) => x >= 0 && y >= 0 && x < world.w && y < world.h;
  const border = (world, x, y) => x <= 0 || y <= 0 || x >= world.w - 1 || y >= world.h - 1;
  const isDoor = (c) => c >= "A" && c <= "C";
  const isButton = (c) => c >= "a" && c <= "c";
  const closedDoor = (world, c) => (isDoor(c) && !world.pressed.has(c.toLowerCase())) || (c === "X" && !world.held);

  // Can something that walks on the ground stand here?
  function walkable(world, x, y) {
    if (!inside(world, x, y)) return false;
    const c = world.grid[y][x];
    if (c === "#" || c === "F" || c === "L") return false;
    return !closedDoor(world, c);
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
    t: 0, particles: [], popups: [], shake: 0, sound: true, touchDir: [null, null],
  };
  let canvas, ctx, staticCanvas, staticCtx, tile = 32, dpr = 1;

  function makePlayer(i, start) {
    return { id: i, x: start[0], y: start[1], fx: start[0], fy: start[1], sx: start[0], sy: start[1], tx: 0, ty: 0,
      moving: false, facing: 1, flyT: 0, inv: 0, hurtT: 0, dir: [1, 0], slide: null };
  }

  function startLevel(def) {
    G.world = parse(def);
    G.world.playersList = [];
    for (let i = 0; i < G.players; i++) G.world.playersList.push(makePlayer(i, G.world.starts[i]));
    G.particles = [];
    G.popups = [];
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
  const BEEPS = {
    step: () => {},
    key: () => { beep(880, 0.12); setTimeout(() => beep(1320, 0.15), 90); },
    star: () => { beep(1046, 0.1); setTimeout(() => beep(1568, 0.18), 70); },
    button: () => beep(330, 0.25, "square", 660),
    unlock: () => beep(520, 0.3, "sawtooth", 1040),
    wings: () => beep(400, 0.5, "sine", 1600),
    hurt: () => beep(300, 0.35, "sawtooth", 80),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.25), i * 140)),
    lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.3), i * 180)),
    unpress: () => beep(500, 0.15, "square", 250),
    candy: (n) => beep(700 + (n || 1) * 120, 0.07, "square"),
    portal: () => beep(200, 0.35, "sine", 1200),
    slide: () => beep(900, 0.15, "sine", 600),
    medal: () => beep(1175, 0.18, "triangle", 1568),
    sticker: () => [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 90)),
  };
  // Your own recorded voices win over the beeps (see js/voices.js)
  function sfx(name, arg) {
    if (!G.sound) return;
    if (window.MazooleVoices && window.MazooleVoices.play(name)) return;
    (BEEPS[name] || (() => {}))(arg);
  }

  // ------------------------------------------------------------ points & awards
  function popup(x, y, text, color) {
    G.popups.push({ x: x + 0.5, y: y + 0.1, text, color: color || "#2e2e33", life: 1.1 });
  }
  function addPoints(W, n, x, y, label) {
    W.score += n;
    popup(x, y, label || "+" + n);
  }
  function count(stat, n) {
    const P2 = window.MazooleProgress;
    if (P2) UI.stickers(P2.bump(stat, n));
  }

  // ------------------------------------------------------------ update
  function update(dt) {
    const W = G.world;
    G.t += dt;
    for (const p of G.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 3 * dt; p.life -= dt; }
    G.particles = G.particles.filter((p) => p.life > 0);
    for (const p of G.popups) { p.y -= dt * 0.9; p.life -= dt; }
    G.popups = G.popups.filter((p) => p.life > 0);
    if (G.shake > 0) G.shake -= dt;
    if (G.mode !== "play") return;
    W.time += dt;

    for (const p of W.playersList) updatePlayer(W, p, dt);
    // purple plates only work while someone (not flying) stands on one
    const held = W.playersList.some((p) => p.flyT <= 0 && W.grid[Math.round(p.fy)][Math.round(p.fx)] === "x");
    if (held !== W.held) { W.held = held; W.dirty = true; sfx(held ? "button" : "unpress"); }
    for (const m of W.monsters) updateMonster(W, m, dt);
    for (const f of W.turrets) updateTurret(W, f);

    // collisions
    for (const p of W.playersList) {
      if (p.inv > 0) continue;
      const grounded = p.flyT <= 0;
      if (grounded) for (const m of W.monsters) {
        if (m.wait > 0) continue; // a sleeping ghost can't catch anyone
        if (Math.hypot(m.fx - p.fx, m.fy - p.fy) < 0.62) {
          if (m.kind === "g") { // the ghost poofs home after catching someone
            W.caught++; burst(m.x, m.y, "#b9a7e8"); m.x = m.fx = m.sx; m.y = m.fy = m.sy; m.moving = false; m.wait = 3;
          }
          hurt(W, p, m.kind);
          break;
        }
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
    if (!p.moving && p.slide) {
      // on ice you keep going until something stops you
      const [dx, dy] = p.slide, nx = p.x + dx, ny = p.y + dy;
      if (W.grid[p.y][p.x] === "~" && p.flyT <= 0 && W.grid[ny][nx] !== "L" && playerCanEnter(W, p, nx, ny)) {
        p.tx = nx; p.ty = ny; p.moving = true;
      } else p.slide = null;
    }
    if (!p.moving && !p.slide) {
      const d = dirFor(p.id);
      if (d) {
        const [dx, dy] = DIRS[d];
        if (dx) p.facing = dx;
        p.dir = [dx, dy];
        const nx = p.x + dx, ny = p.y + dy;
        if (playerCanEnter(W, p, nx, ny)) {
          if (W.grid[ny][nx] === "L" && p.flyT <= 0) {
            W.keys--; W.grid[ny][nx] = "."; W.dirty = true; sfx("unlock"); burst(nx, ny, "#f5d33b");
            addPoints(W, POINTS.unlock, nx, ny); UI.updateHud();
          }
          p.tx = nx; p.ty = ny; p.moving = true;
        }
      }
    }
    if (p.moving) {
      const step = (p.slide ? SLIDE_SPEED : SPEED) * dt;
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
    const grounded = p.flyT <= 0;
    if (c === "~" && grounded) {
      if (!p.slide) sfx("slide");
      p.slide = p.dir;
      count("slides");
    } else p.slide = null;
    if (c === "k") { W.keys++; W.grid[p.y][p.x] = "."; sfx("key"); burst(p.x, p.y, "#f5d33b"); addPoints(W, POINTS.key, p.x, p.y); }
    else if (c === "*") { W.stars++; W.grid[p.y][p.x] = "."; sfx("star"); burst(p.x, p.y, "#ffc93c"); addPoints(W, POINTS.star, p.x, p.y); }
    else if (c === "+") {
      W.grid[p.y][p.x] = "."; W.candy++;
      W.combo = G.t - W.lastCandy < 0.75 ? Math.min(5, W.combo + 1) : 1;
      W.lastCandy = G.t;
      sfx("candy", W.combo);
      addPoints(W, POINTS.candy * W.combo, p.x, p.y, W.combo > 1 ? `+${POINTS.candy * W.combo} x${W.combo}` : null);
      count("candy");
      if (window.MazooleProgress) UI.stickers(window.MazooleProgress.best("bestCombo", W.combo));
    }
    else if (c >= "3" && c <= "9" && grounded) {
      const other = (W.portals[c] || []).find((q) => q[0] !== p.x || q[1] !== p.y);
      if (other) {
        burst(p.x, p.y, P.PORTAL_COLORS[(+c - 3) % 7]);
        p.x = p.fx = other[0]; p.y = p.fy = other[1];
        p.slide = null;
        sfx("portal");
        burst(p.x, p.y, P.PORTAL_COLORS[(+c - 3) % 7]);
        count("ports");
      }
    }
    else if (c === "w") {
      if (p.flyT <= 0) { sfx("wings"); addPoints(W, POINTS.wings, p.x, p.y); count("flights"); }
      p.flyT = WINGS_TIME; p.wx = p.x; p.wy = p.y; burst(p.x, p.y, "#c9a6ff");
    }
    else if (isButton(c) && !W.pressed.has(c)) { W.pressed.add(c); W.dirty = true; sfx("button"); burst(p.x, p.y, P.DOOR_COLORS[c]); addPoints(W, POINTS.button, p.x, p.y); }
    else if (c === "h" && p.flyT <= 0) hurt(W, p, "trap");
    else if (c === "G") return win(W);
    UI.updateHud();
  }

  // The ghost walks toward the nearest player on the ground (flying players are safe)
  function updateGhost(W, m, dt) {
    if (m.fx == null) { m.fx = m.x; m.fy = m.y; }
    if (m.wait > 0) { m.wait -= dt; return; }
    if (!m.moving) {
      const targets = new Set(W.playersList.filter((p) => p.flyT <= 0 && p.inv <= 0).map((p) => Math.round(p.fx) + "," + Math.round(p.fy)));
      let step = null;
      if (targets.size) {
        const prev = new Map([[m.x + "," + m.y, null]]), q = [[m.x, m.y]];
        let found = null;
        const depth = new Map([[m.x + "," + m.y, 0]]);
        for (let i = 0; i < q.length && !found; i++) {
          const [x, y] = q[i];
          if (depth.get(x + "," + y) >= GHOST_SIGHT) continue; // too far away: lose interest
          for (const [dx, dy] of Object.values(DIRS)) {
            const k = x + dx + "," + (y + dy);
            if (prev.has(k) || !monsterFree(W, x + dx, y + dy)) continue;
            prev.set(k, x + "," + y); depth.set(k, depth.get(x + "," + y) + 1); q.push([x + dx, y + dy]);
            if (targets.has(k)) { found = k; break; }
          }
        }
        if (found) {
          let k = found;
          while (prev.get(k) !== m.x + "," + m.y) k = prev.get(k);
          step = k.split(",").map(Number);
        }
      }
      if (!step) { // nobody to chase: wander
        const opts = Object.values(DIRS).map(([dx, dy]) => [m.x + dx, m.y + dy]).filter(([x, y]) => monsterFree(W, x, y));
        if (opts.length) step = opts[Math.floor(Math.random() * opts.length)];
      }
      if (!step) return;
      m.tx = step[0]; m.ty = step[1]; m.moving = true;
    }
    const sp = MONSTER_SPEED.g * dt, ddx = m.tx - m.fx, ddy = m.ty - m.fy, dist = Math.hypot(ddx, ddy);
    if (dist <= sp) { m.fx = m.x = m.tx; m.fy = m.y = m.ty; m.moving = false; }
    else { m.fx += (ddx / dist) * sp; m.fy += (ddy / dist) * sp; }
  }

  function updateMonster(W, m, dt) {
    if (m.kind === "g") return updateGhost(W, m, dt);
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
      if (c === "#" || c === "F" || c === "L" || closedDoor(W, c)) break;
      f.cells.push([x, y]);
      x += f.dx; y += f.dy;
    }
  }

  function hurt(W, p, why) {
    if (p.inv > 0 || G.mode !== "play") return;
    G.lastHurt = { why, x: p.x, y: p.y };
    W.hearts--;
    W.hurts++;
    W.combo = 0;
    G.shake = 0.35;
    sfx("hurt");
    burst(p.x, p.y, "#b5405a");
    p.hurtT = 0.6;
    p.inv = INVULN;
    p.flyT = 0;
    p.moving = false;
    p.slide = null;
    p.x = p.fx = p.sx; p.y = p.fy = p.sy;
    UI.updateHud();
    if (W.hearts <= 0) { G.mode = "lost"; sfx("lose"); UI.showLost(); }
  }

  function win(W) {
    G.mode = "won";
    W.won = true;
    sfx("win");
    const gy = W.grid.findIndex((r) => r.includes("G")), gx = W.grid[gy].indexOf("G");
    for (let i = 0; i < 40; i++) burst(gx, gy, ["#e5484d", "#f5d33b", "#3e7bfa", "#2fae62", "#ff8fc1"][i % 5], 1);
    // the score sheet
    const allStars = W.stars === W.starsTotal;
    const fast = W.time <= W.par;
    const r = {
      points: W.score,
      timeBonus: Math.max(0, Math.round((W.par - W.time) * 10)),
      heartBonus: W.hearts * 50,
      noOuch: W.hurts === 0 ? 300 : 0,
      medalsNow: 1 | (allStars ? 2 : 0) | (fast ? 4 : 0),
      time: W.time, par: W.par, hurts: W.hurts, caught: W.caught, stars: W.stars, starsTotal: W.starsTotal,
      coop: !!W.def.coop, hasGhost: W.monsters.some((m) => m.kind === "g"),
    };
    r.score = r.points + r.timeBonus + r.heartBonus + r.noOuch;
    const PR = window.MazooleProgress;
    if (W.def.fromEditor) count("ownPlays");
    const prog = PR ? PR.finish(W.def, r) : { isBest: false, newMedals: 0, stickers: [], best: r.score };
    UI.updateHud();
    setTimeout(() => UI.showWon(W, r, prog), 900);
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
    if (W.photoImg && W.photoImg.complete && W.photoImg.naturalWidth) {
      sctx.save(); sctx.globalAlpha = W.photoAlpha || 0.22;
      sctx.drawImage(W.photoImg, 0, 0, W.w * s, W.h * s);
      sctx.restore();
    }
    P.walls(sctx, W.grid, (c) => c === "#", s);
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
      const c = W.grid[y][x], seed = P.hash(x, y, 5);
      if (isDoor(c)) P.door(sctx, x, y, s, c.toLowerCase(), W.pressed.has(c.toLowerCase()), seed);
      else if (c === "L") P.lockDoor(sctx, x, y, s, seed);
      else if (isButton(c)) P.button(sctx, x, y, s, c, W.pressed.has(c), seed);
      else if (c === "X") P.door(sctx, x, y, s, "x", W.held, seed);
      else if (c === "x") P.plate(sctx, x, y, s, W.held, seed);
      else if (c === "~") P.ice(sctx, x, y, s, seed);
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
      else if (ch === "+") P.candy(c, cx, cy + bob * 0.5, s, r, x + y);
      else if (ch >= "3" && ch <= "9") P.portal(c, cx, cy, s, t, +ch);
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
      if (m.kind === "g") {
        c.save();
        if (m.wait > 0) c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 8); // asleep: see-through and harmless
        P.ghost(c, fx * s + s / 2, fy * s + s / 2, s, t, m.id, players0(W).some((p) => p.flyT > 0));
        c.restore();
      }
      else (m.kind === "s" ? P.spider : P.monster)(c, fx * s + s / 2, fy * s + s / 2, s, t, m.id);
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
    for (const p of G.popups) {
      c.save();
      c.globalAlpha = Math.min(1, p.life * 1.5);
      c.font = `bold ${Math.round(s * 0.42)}px 'Patrick Hand', cursive`;
      c.textAlign = "center";
      c.lineWidth = 4; c.strokeStyle = P.PAPER; c.strokeText(p.text, p.x * s, p.y * s);
      c.fillStyle = p.color; c.fillText(p.text, p.x * s, p.y * s);
      c.restore();
    }
  }
  const players0 = (W) => W.playersList || [];

  function frame(now) {
    const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
    frame.last = now;
    if (G.mode === "edit") { window.MazooleEditor && window.MazooleEditor.render(dt); }
    else if (G.world) {
      update(dt);
      if (G.world.dirty) drawStatic(G.world, tile);
      const sh = G.shake > 0 ? G.shake * 14 : 0;
      ctx.setTransform(dpr, 0, 0, dpr, (Math.random() - 0.5) * sh * dpr, (Math.random() - 0.5) * sh * dpr);
      renderWorld(G.world, ctx, tile, G.t);
      UI.clock();
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
      const PR = window.MazooleProgress;
      const total = PR ? PR.medalCount() : 0;
      $("medal-total").textContent = `${total} / ${window.MAZOOLE_LEVELS.length * 3}`;
      window.MAZOOLE_LEVELS.forEach((lv, i) => {
        const b = document.createElement("button");
        const info = PR ? PR.levelInfo(lv) : { medals: 0, best: 0 };
        const locked = PR && !PR.unlocked(lv);
        b.className = "card" + (lv.bonus ? " bonus" : "") + (locked ? " locked" : "");
        b.innerHTML = `<b>${lv.bonus ? "★ " : i + 1 + ". "}${lv.name}</b>` +
          (lv.coop ? `<i class="badge">2 players</i>` : "") + (lv.bonus ? `<i class="badge gold">secret level</i>` : "") +
          (locked ? `<span>🔒 Collect ${lv.bonus} medals to open this level. You have ${total}.</span>`
                  : `<span>${lv.story}</span>`) +
          `<div class="card-foot"><span class="medals"></span><span class="best">${info.best ? "Best " + info.best.toLocaleString() : ""}</span></div>`;
        const row = b.querySelector(".medals");
        for (let m = 0; m < 3; m++) row.appendChild(icon((c, k) => P.medal(c, k / 2, k * 0.62, k * 0.4, (info.medals >> m) & 1), 26));
        if (locked) { b.onclick = () => UI.toast(`Keep playing! ${lv.bonus - total} more medals to open the secret level.`); list.appendChild(b); return; }
        b.onclick = () => {
          if (lv.coop && G.players === 1) { G.players = 2; UI.toast("This maze needs two players, so the fairy is joining in!"); }
          G.levelIndex = i; G.customDef = null; startLevel(lv);
        };
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
    toast(msg) {
      const t = $("toast");
      t.textContent = msg;
      t.hidden = false;
      clearTimeout(UI.toastTimer);
      UI.toastTimer = setTimeout(() => (t.hidden = true), 3500);
    },
    showIntro(def) {
      $("intro-title").textContent = def.name;
      $("intro-story").textContent = def.story || "";
      const W = G.world, PR = window.MazooleProgress, have = PR ? PR.levelInfo(def).medals : 0;
      const goals = [
        def.goal === "friend" ? "Rescue your friend" : "Reach the gift",
        W.starsTotal ? `Collect all ${W.starsTotal} star${W.starsTotal > 1 ? "s" : ""}` : "Collect all the stars (there are none, easy!)",
        `Finish in under ${W.par} seconds`,
      ];
      const ul = $("intro-goals");
      ul.innerHTML = "";
      goals.forEach((g, m) => {
        const li = document.createElement("li");
        li.appendChild(icon((c, k) => P.medal(c, k / 2, k * 0.62, k * 0.4, (have >> m) & 1), 30));
        li.append(g);
        ul.appendChild(li);
      });
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
    showWon(W, r, prog) {
      if (G.mode !== "won" || G.world !== W) return; // they already moved on
      $("won-title").textContent = W.def.goal === "friend" ? "You rescued your friend!" : "You found the gift!";
      // three medals pop in one by one
      const medals = $("won-medals");
      medals.innerHTML = "";
      const labels = ["Finished", "All stars", "Beat the clock"];
      for (let m = 0; m < 3; m++) {
        const got = (r.medalsNow >> m) & 1;
        const cell = document.createElement("div");
        cell.className = "won-medal" + (got ? " got" : "");
        cell.style.animationDelay = 0.25 + m * 0.35 + "s";
        cell.appendChild(icon((c, k) => P.medal(c, k / 2, k * 0.62, k * 0.4, got), 64));
        const cap = document.createElement("span");
        cap.textContent = labels[m] + ((prog.newMedals >> m) & 1 ? " · new!" : "");
        cell.appendChild(cap);
        medals.appendChild(cell);
        if (got) setTimeout(() => sfx("medal"), 250 + m * 350);
      }
      const secs = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
      const lines = [
        ["Points collected", r.points],
        [`Time ${secs(r.time)} (clock ${secs(r.par)})`, r.timeBonus],
        [`Hearts left × 50`, r.heartBonus],
        ["No ouch bonus", r.noOuch],
      ];
      $("won-sheet").innerHTML = lines.map(([k, v]) => `<div><span>${k}</span><b>${v ? "+" + v.toLocaleString() : "0"}</b></div>`).join("") +
        `<div class="total"><span>Score</span><b id="won-total">0</b></div>`;
      $("won-best").textContent = prog.isBest ? "New best score!" : `Best: ${prog.best.toLocaleString()}`;
      $("won-best").classList.toggle("new", prog.isBest);
      // count the score up like an arcade machine
      const start = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - start) / 1200);
        $("won-total").textContent = Math.round(r.score * (1 - Math.pow(1 - k, 3))).toLocaleString();
        if (k < 1 && G.mode === "won") requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      UI.stickers(prog.stickers);
      const last = G.customDef || G.levelIndex >= window.MAZOOLE_LEVELS.length - 1;
      $("btn-next").textContent = last ? "Back to menu" : "Next maze →";
      document.querySelector("#won .btn-menu").hidden = last && !(G.customDef && G.customDef.fromEditor);
      if (G.customDef && G.customDef.fromEditor) $("btn-next").textContent = "Back to drawing ✏️";
      UI.show("won");
    },
    next() {
      if (G.customDef && G.customDef.fromEditor) return window.MazooleEditor.open();
      if (G.customDef || G.levelIndex >= window.MAZOOLE_LEVELS.length - 1) return UI.menu();
      const nextDef = window.MAZOOLE_LEVELS[G.levelIndex + 1];
      if (window.MazooleProgress && !window.MazooleProgress.unlocked(nextDef)) {
        UI.menu();
        return UI.toast(`The secret level opens at ${nextDef.bonus} medals. Replay mazes to earn more!`);
      }
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
      $("hud-score").textContent = W.score.toLocaleString();
    },
    clock() {
      const W = G.world;
      if (!W || !W.playersList || !W.playersList.length) return;
      const sec = Math.floor(W.time);
      if (sec === UI.lastSec) return;
      UI.lastSec = sec;
      const el = $("hud-clock");
      el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
      el.classList.toggle("late", W.time > W.par);
      $("hud-score").textContent = W.score.toLocaleString();
    },
    // Celebrate new stickers, one after another
    stickers(list) {
      if (!list || !list.length) return;
      UI.stickerQueue = (UI.stickerQueue || []).concat(list);
      if (!UI.stickerBusy) UI.nextSticker();
    },
    nextSticker() {
      const st = UI.stickerQueue.shift();
      const box = $("sticker-pop");
      if (!st) { UI.stickerBusy = false; box.hidden = true; return; }
      UI.stickerBusy = true;
      box.innerHTML = "";
      box.appendChild(window.MazooleProgress.stickerCanvas(st, 54, true));
      const t = document.createElement("div");
      t.innerHTML = `<small>New sticker!</small><b>${st.name}</b>`;
      box.appendChild(t);
      box.hidden = false;
      box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop");
      sfx("sticker");
      setTimeout(UI.nextSticker, 2600);
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
