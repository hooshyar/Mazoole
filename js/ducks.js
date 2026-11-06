// Quack Hunt: pencil ducks fly around the room. Turn with the phone to find
// them, get one in the circle and press Shoot. 10 ducks a game, records saved,
// and a few secrets to discover. Uses the look-around engine from js/hunt.js
// (camera + motion sensors, or dragging when there are no sensors).
(function () {
  const P = window.Pencil;
  const $ = (id) => document.getElementById(id);
  const STORE = "mazoole.ducks";
  const DUCKS = 10;       // ducks per game
  const PER_WAVE = 2;     // ducks flying at the same time
  const SHELLS = 4;       // shots per wave
  const WAVE_TIME = 9;    // seconds before the ducks of a wave fly away
  const RELOAD = 0.35;    // seconds between shots

  // Secrets, with a hint shown until each is found
  const SECRETS = [
    { id: "golden", name: "The Golden Duck", hint: "Something shiny flies by now and then…", prize: "star" },
    { id: "owl", name: "The Ceiling Owl", hint: "Someone is sleeping up high… look up!" },
    { id: "frog", name: "The Floor Frog", hint: "Someone is hiding down low… look down!" },
    { id: "shake", name: "Earthquake!", hint: "What happens if you shake, shake, shake?" },
    { id: "double", name: "Two with One", hint: "Can one shot catch two ducks?" },
    { id: "perfect", name: "Perfect Ten", hint: "Catch every single duck in a game", prize: "gift" },
  ];

  function load() {
    try { const d = JSON.parse(localStorage.getItem(STORE)); if (d && typeof d === "object") return Object.assign(blank(), d); } catch (_) { /* first time */ }
    return blank();
  }
  function blank() { return { best: 0, bestScore: 0, games: 0, total: 0, secrets: {} }; }
  let rec = load();
  function save() { try { localStorage.setItem(STORE, JSON.stringify(rec)); } catch (_) { /* private mode */ } }

  const ar = () => window.MazooleHunt.ar;
  const UI = () => window.Mazoole.UI;

  // ------------------------------------------------------------ the duck drawing
  // An original pencil duck: round body, green head, orange beak, flapping wing.
  function duck(c, x, y, s, t, o) {
    o = o || {};
    const r = P.rng(P.hash(Math.floor(t * 6), o.id || 1, 51));
    const f = o.face || 1;
    c.save();
    c.translate(x, y);
    if (o.hit) c.rotate(Math.sin(t * 9) * 0.5 + Math.PI * 0.15 * f);
    c.scale(f, 1);
    const body = o.gold ? "#ffd23f" : o.rainbow ? `hsl(${(t * 120 + (o.id || 0) * 60) % 360},85%,62%)` : "#b07a45";
    const head = o.gold ? "#ffe680" : "#2f9e5a";
    // tail
    P.stroke(c, [[-s * 0.3, -s * 0.02], [-s * 0.46, -s * 0.12], [-s * 0.36, s * 0.06]], r, s * 0.02, Math.max(1.5, s * 0.02));
    // body
    P.ellipse(c, 0, 0, s * 0.33, s * 0.2, r, Math.max(1.5, s * 0.025), P.INK, body);
    // head and white neck ring
    P.ellipse(c, s * 0.27, -s * 0.2, s * 0.14, s * 0.13, r, Math.max(1.5, s * 0.025), P.INK, head);
    P.stroke(c, [[s * 0.18, -s * 0.1], [s * 0.33, -s * 0.09]], r, s * 0.01, Math.max(2, s * 0.03), "#fff");
    // beak
    c.beginPath(); c.moveTo(s * 0.38, -s * 0.22); c.lineTo(s * 0.55, -s * 0.18); c.lineTo(s * 0.38, -s * 0.13); c.closePath();
    c.fillStyle = "#ff9f1c"; c.fill();
    P.stroke(c, [[s * 0.38, -s * 0.22], [s * 0.55, -s * 0.18], [s * 0.38, -s * 0.13]], r, s * 0.01, Math.max(1.2, s * 0.018));
    // eye: a dot, or dizzy X when caught
    if (o.hit) {
      P.stroke(c, [[s * 0.26, -s * 0.26], [s * 0.32, -s * 0.2]], r, 0, Math.max(1.5, s * 0.02));
      P.stroke(c, [[s * 0.32, -s * 0.26], [s * 0.26, -s * 0.2]], r, 0, Math.max(1.5, s * 0.02));
    } else {
      c.fillStyle = P.INK; c.beginPath(); c.arc(s * 0.3, -s * 0.23, s * 0.025, 0, Math.PI * 2); c.fill();
    }
    // wing flapping up and down
    const flap = o.hit ? 0.2 : Math.sin(t * 16 + (o.id || 0));
    c.save();
    c.translate(-s * 0.02, -s * 0.04);
    c.rotate(-flap * 0.7);
    P.ellipse(c, -s * 0.06, -s * 0.12, s * 0.2, s * 0.08, r, Math.max(1.5, s * 0.022), P.INK, o.gold ? "#fff3a0" : "#8a5a2b");
    c.restore();
    c.restore();
    if (o.gold && !o.hit) for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * 2.1;
      P.star(c, x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.35, s * 0.06, r, "#fff3a0");
    }
    if (o.hit) for (let i = 0; i < 3; i++) { // dizzy stars
      const a = t * 7 + i * 2.1;
      P.star(c, x + Math.cos(a) * s * 0.3, y - s * 0.4 + Math.sin(a) * s * 0.08, s * 0.05, r, "#ffc93c");
    }
  }

  function owl(c, x, y, s, t, awake) {
    const r = P.rng(P.hash(Math.floor(t * 4), 9, 52));
    P.ellipse(c, x, y, s * 0.3, s * 0.36, r, Math.max(1.5, s * 0.025), P.INK, "#9c7a5b");
    P.ellipse(c, x, y + s * 0.08, s * 0.18, s * 0.2, r, 1.5, P.INK, "#e8d5b5");
    for (const sx of [-1, 1]) {
      P.ellipse(c, x + sx * s * 0.12, y - s * 0.14, s * 0.1, s * 0.1, r, 1.5, P.INK, "#fff");
      if (awake) { c.fillStyle = P.INK; c.beginPath(); c.arc(x + sx * s * 0.12, y - s * 0.14, s * 0.04, 0, Math.PI * 2); c.fill(); }
      else P.stroke(c, [[x + sx * s * 0.12 - s * 0.06, y - s * 0.13], [x + sx * s * 0.12 + s * 0.06, y - s * 0.13]], r, 0, 2);
      P.stroke(c, [[x + sx * s * 0.2, y - s * 0.3], [x + sx * s * 0.12, y - s * 0.4]], r, 0, 2); // ear tufts
    }
    c.beginPath(); c.moveTo(x - s * 0.04, y - s * 0.05); c.lineTo(x + s * 0.04, y - s * 0.05); c.lineTo(x, y + s * 0.03); c.closePath();
    c.fillStyle = "#ff9f1c"; c.fill();
    if (!awake) { // z z z
      c.save(); c.fillStyle = "#fff"; c.strokeStyle = P.INK; c.lineWidth = 3;
      c.font = `bold ${Math.round(s * 0.18)}px 'Patrick Hand', cursive`;
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.6 + i / 3) % 1;
        c.globalAlpha = 1 - k;
        c.strokeText("z", x + s * 0.3 + k * s * 0.3, y - s * 0.3 - k * s * 0.4);
        c.fillText("z", x + s * 0.3 + k * s * 0.3, y - s * 0.3 - k * s * 0.4);
      }
      c.restore();
    }
  }

  function frog(c, x, y, s, t, awake) {
    const r = P.rng(P.hash(Math.floor(t * 4), 10, 53));
    const hop = awake ? -Math.abs(Math.sin(t * 8)) * s * 0.3 : 0;
    y += hop;
    P.ellipse(c, x, y, s * 0.34, s * 0.22, r, Math.max(1.5, s * 0.025), P.INK, "#5cc45a");
    for (const sx of [-1, 1]) {
      P.ellipse(c, x + sx * s * 0.15, y - s * 0.2, s * 0.09, s * 0.09, r, 1.5, P.INK, "#5cc45a");
      P.ellipse(c, x + sx * s * 0.15, y - s * 0.2, s * 0.05, s * 0.05, r, 1.2, P.INK, "#fff");
      c.fillStyle = P.INK; c.beginPath(); c.arc(x + sx * s * 0.15, y - s * 0.2, s * 0.02, 0, Math.PI * 2); c.fill();
    }
    P.stroke(c, [[x - s * 0.14, y + s * 0.02], [x, y + s * 0.08], [x + s * 0.14, y + s * 0.02]], r, 0, 2);
  }

  function icon(draw, size) {
    const c = document.createElement("canvas");
    c.width = c.height = size * 2;
    c.style.width = c.style.height = size + "px";
    const x = c.getContext("2d");
    x.scale(2, 2);
    draw(x, size);
    return c;
  }

  // ------------------------------------------------------------ start screen
  function open() {
    if (window.MazooleHunt) window.MazooleHunt.stop();
    document.body.classList.add("in-menu");
    $("ducks-records").innerHTML = rec.games
      ? `Best: <b>${rec.best} of ${DUCKS}</b> ducks · Best score <b>${rec.bestScore.toLocaleString()}</b><br>Ducks caught so far: <b>${rec.total}</b> in ${rec.games} game${rec.games > 1 ? "s" : ""}`
      : "No records yet. Be the first!";
    const grid = $("ducks-secrets");
    grid.innerHTML = "";
    let n = 0;
    for (const s of SECRETS) {
      const got = !!rec.secrets[s.id];
      if (got) n++;
      const li = document.createElement("li");
      li.className = got ? "got" : "";
      li.innerHTML = got ? `<b>✓ ${s.name}</b>` : `<span>🤫 ${s.hint}</span>`;
      grid.appendChild(li);
    }
    $("ducks-secret-count").textContent = `Secrets found: ${n} of ${SECRETS.length}`;
    const pic = $("ducks-pic");
    if (!pic.firstChild) pic.appendChild(icon((c, k) => { duck(c, k * 0.3, k * 0.55, k * 0.55, 0.1, { face: 1 }); duck(c, k * 0.72, k * 0.35, k * 0.45, 0.4, { face: -1, id: 2, gold: true }); }, 120));
    UI().show("ducks");
  }

  // ------------------------------------------------------------ the game
  const D = {
    on: false, ducks: [], wave: 0, shells: 0, hits: 0, score: 0, slots: [], center: 0, reload: 0, flash: 0,
    dizzy: 0, shook: false, found: [], owl: null, frog: null, between: 0, golden: 0, streak: 0, ids: 0, rainbow: false, lastShake: 0,
  };

  function begin() {
    Object.assign(D, { on: false, ducks: [], wave: 0, shells: 0, hits: 0, score: 0, slots: [], reload: 0, flash: 0, dizzy: 0, shook: false, found: [], owl: null, frog: null, between: 0, streak: 0, ids: 0 });
    D.golden = 1 + Math.floor(Math.random() * (DUCKS / PER_WAVE)); // the golden duck comes in this wave…
    if (Math.random() < 0.4) D.golden = 0; // …but not every game
    D.rainbow = !!rec.secrets.perfect && Math.random() < 0.5; // a reward for a perfect game: rainbow ducks sometimes
    for (let i = 0; i < DUCKS; i++) D.slots.push("");
    buildSlots();
    updateBar();
    // shaking needs permission on iPhones, asked during the tap
    const M = window.DeviceMotionEvent;
    if (M && typeof M.requestPermission === "function") { try { M.requestPermission().catch(() => {}); } catch (_) { /* not here */ } }
    window.addEventListener("devicemotion", onMotion);
  }

  function go() {
    D.on = true;
    D.between = 1.2;
    $("hunt-say").hidden = true;
  }

  function stopped() {
    D.on = false;
    window.removeEventListener("devicemotion", onMotion);
  }

  function onMotion(e) {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || !D.on) return;
    const g = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    const now = performance.now();
    if (g > 26 && now - D.lastShake > 3000) { D.lastShake = now; quake(); }
  }

  function quake() {
    D.dizzy = 4;
    UI().toast("Earthquake! The ducks are all dizzy! 🌀");
    secret("shake");
  }

  function buildSlots() {
    const bag = $("hunt-bag");
    bag.innerHTML = "";
    for (let i = 0; i < DUCKS; i++) {
      const s = document.createElement("span");
      s.className = "slot duck-slot " + D.slots[i];
      s.appendChild(icon((c, k) => {
        c.globalAlpha = D.slots[i] === "got" ? 1 : 0.3;
        duck(c, k / 2, k * 0.58, k * 0.9, 0, { face: 1, gold: D.slots[i] === "got gold" });
      }, 26));
      bag.appendChild(s);
    }
  }

  function updateBar() {
    $("duck-score").textContent = D.score.toLocaleString();
    $("duck-shells").textContent = "●".repeat(D.shells) + "○".repeat(Math.max(0, SHELLS - D.shells));
    $("duck-wave").textContent = D.wave ? `Ducks ${Math.min(D.wave * PER_WAVE, DUCKS)} / ${DUCKS}` : "Get ready…";
  }

  function nextWave() {
    if (D.wave * PER_WAVE >= DUCKS) return end();
    D.wave++;
    D.shells = SHELLS;
    const R = ar().viewMatrix();
    D.center = ar().heading(R);
    if (!D.owl) { // the secret owl and frog stay in the same places all game
      D.owl = { az: D.center + 20, el: 80, awake: false };
      D.frog = { az: D.center - 25, el: -78, awake: false };
    }
    const speed = 1 + (D.wave - 1) * 0.12;
    for (let i = 0; i < PER_WAVE; i++) {
      const gold = D.wave === D.golden && i === 0;
      D.ducks.push({
        id: ++D.ids, n: (D.wave - 1) * PER_WAVE + i, gold,
        az: D.center + (i ? 25 : -25) + (Math.random() - 0.5) * 20, el: -18,
        vaz: (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 8) * speed * (gold ? 1.5 : 1),
        vel: (12 + Math.random() * 7) * speed, state: "fly", t: 0, face: 1,
      });
    }
    ar().sfx("quack");
    updateBar();
  }

  function update(dt) {
    if (!D.on) return;
    D.reload = Math.max(0, D.reload - dt);
    D.flash = Math.max(0, D.flash - dt);
    D.dizzy = Math.max(0, D.dizzy - dt);
    const slow = D.dizzy > 0 ? 0.25 : 1;
    let flying = 0;
    for (const d of D.ducks) {
      d.t += dt;
      if (d.state === "fly") {
        flying++;
        d.az += d.vaz * dt * slow;
        d.el += d.vel * dt * slow;
        if (d.el > 45) d.vel = -Math.abs(d.vel);
        if (d.el < -15) d.vel = Math.abs(d.vel);
        if (Math.abs(d.az - D.center) > 60) d.vaz = -Math.sign(d.az - D.center) * Math.abs(d.vaz);
        if (Math.random() < dt * 0.35) d.vaz *= -1; // ducks change their minds
        if (d.t > WAVE_TIME || (D.shells === 0 && D.reload === 0 && d.t > 1)) escape(d);
      } else if (d.state === "escape") {
        d.el += 70 * dt;
        d.az += d.vaz * dt;
        if (d.el > 85) d.state = "gone";
      } else if (d.state === "hit") {
        d.fall = (d.fall || 0) + dt;
        if (d.fall > 0.5) d.el -= (25 + (d.fall - 0.5) * 90) * dt; // a little hover, then down it goes
        if (d.el < -55) d.state = "gone";
      }
    }
    D.ducks = D.ducks.filter((d) => d.state !== "gone");
    if (!D.ducks.length) {
      D.between -= dt;
      if (D.between <= 0) { D.between = 1.2; nextWave(); }
    }
  }

  function escape(d) {
    d.state = "escape";
    D.slots[d.n] = "missed";
    D.streak = 0;
    buildSlots();
    ar().sfx("flyaway");
    UI().toast(d.gold ? "Oh no, the golden duck flew away!" : "Flew away! 🦆💨");
  }

  // ------------------------------------------------------------ shooting
  function shoot() {
    if (!D.on) return;
    if (D.reload > 0) return;
    if (!D.ducks.some((d) => d.state === "fly") || D.shells <= 0) { ar().sfx("empty"); return; }
    D.shells--;
    D.reload = RELOAD;
    D.flash = 0.18;
    ar().sfx("shoot");
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (_) { /* no buzz */ }
    const W = innerWidth, Hh = innerHeight, ring = Math.min(W, Hh) * 0.2;
    const inRing = (o) => o && o.vis && Math.hypot(o.sx - W / 2, o.sy - Hh / 2) < ring + o.size * 0.25;
    const got = D.ducks.filter((d) => d.state === "fly" && inRing(d));
    for (const d of got) {
      d.state = "hit";
      D.hits++;
      D.streak++;
      const pts = (d.gold ? 500 : 100) * Math.min(3, D.streak);
      D.score += pts;
      D.slots[d.n] = d.gold ? "got gold" : "got";
      ar().burst(d.sx, d.sy, d.size * 0.4, d.gold ? "#ffd23f" : "#b07a45", 22);
      ar().burst(d.sx, d.sy, d.size * 0.3, "#fff", 10);
      d.pop = { text: "+" + pts, t: 0 };
      if (d.gold) {
        secret("golden");
        if (window.MazoolePowers) window.MazoolePowers.add("star");
        UI().toast("The GOLDEN duck! ⭐ A star for your power bag!");
      }
    }
    if (got.length) { setTimeout(() => ar().sfx("quack"), 120); buildSlots(); }
    if (got.length >= 2) { secret("double"); UI().toast("Two ducks with one shot! 🦆🦆"); }
    // the secret animals
    for (const [key, name] of [["owl", "Hoo hoo! You woke the Ceiling Owl!"], ["frog", "Ribbit! You found the Floor Frog!"]]) {
      const o = D[key];
      if (o && !o.awake && inRing(o)) { o.awake = true; o.wake = 0; D.score += 300; secret(key); UI().toast(name + " +300"); }
    }
    if (!got.length) D.streak = 0;
    updateBar();
  }

  function secret(id) {
    if (!D.found.includes(id)) D.found.push(id);
    if (rec.secrets[id]) return;
    rec.secrets[id] = Date.now();
    save();
    ar().sfx("secret");
    const PR = window.MazooleProgress;
    if (PR) UI().stickers(PR.best("duckSecrets", Object.keys(rec.secrets).length));
  }

  function end() {
    D.on = false;
    const perfect = D.hits === DUCKS;
    if (perfect) {
      secret("perfect");
      if (window.MazoolePowers) window.MazoolePowers.add("gift");
    }
    const newBest = D.hits > rec.best, newScore = D.score > rec.bestScore;
    rec.best = Math.max(rec.best, D.hits);
    rec.bestScore = Math.max(rec.bestScore, D.score);
    rec.games++;
    rec.total += D.hits;
    save();
    window.MazooleHunt.stop();
    ar().sfx(D.hits >= 5 ? "win" : "lose");
    const PR = window.MazooleProgress;
    if (PR) {
      if (D.hits) UI().stickers(PR.bump("ducks", D.hits));
      UI().stickers(PR.best("bestDucks", D.hits));
    }
    $("ducks-done-title").textContent = perfect ? "PERFECT! All 10 ducks!" : D.hits >= 7 ? "Super duck catcher!" : D.hits >= 4 ? "Nice catching!" : "The ducks were quick today!";
    const row = $("ducks-done-row");
    row.innerHTML = "";
    D.slots.forEach((s) => row.appendChild(icon((c, k) => { c.globalAlpha = s.startsWith("got") ? 1 : 0.22; duck(c, k / 2, k * 0.58, k * 0.9, 0, { face: 1, gold: s === "got gold" }); }, 30)));
    const lines = [
      `<div><span>Ducks caught</span><b>${D.hits} / ${DUCKS}</b></div>`,
      `<div class="total"><span>Score</span><b>${D.score.toLocaleString()}</b></div>`,
    ];
    if (newBest && rec.games > 1) lines.push(`<p class="new">New record: ${D.hits} ducks!</p>`);
    else if (newScore && rec.games > 1) lines.push(`<p class="new">New best score!</p>`);
    else lines.push(`<p>Record: ${rec.best} ducks · ${rec.bestScore.toLocaleString()} points</p>`);
    for (const id of D.found) {
      const s = SECRETS.find((x) => x.id === id);
      lines.push(`<p class="secret">🤫 Secret: <b>${s.name}</b>${s.prize === "star" ? " (+⭐ power)" : s.prize === "gift" ? " (+🎁 power)" : ""}</p>`);
    }
    $("ducks-done-sheet").innerHTML = lines.join("");
    UI().show("ducks-done");
  }

  // ------------------------------------------------------------ drawing
  function frame(c, W, Hh, t, dt) {
    update(dt);
    const A = ar(), R = A.viewMatrix(), k = Math.min(W, Hh);
    if (A.state.noCamera) P.paper(c, W, Hh, k * 0.16);
    const ring = k * 0.2;

    // secret animals (only seen when you look straight up or down)
    for (const [key, draw] of [["owl", owl], ["frog", frog]]) {
      const o = D[key];
      if (!o) continue;
      if (o.awake) { o.wake += dt; if (o.wake > 2.5) continue; o.el += (key === "owl" ? -20 : 20) * dt * (o.wake > 1 ? 3 : 0); }
      const p = A.project(R, A.direction(o.az, o.el), W, Hh);
      o.size = k * 0.32; o.sx = p.x; o.sy = p.y;
      o.vis = p.depth > 0.2 && p.x > -o.size && p.x < W + o.size && p.y > -o.size && p.y < Hh + o.size;
      if (o.vis) draw(c, p.x, p.y, o.size, t, o.awake);
    }

    // ducks
    let lock = false, nearest = null;
    for (const d of D.ducks) {
      const p = A.project(R, A.direction(d.az, d.el), W, Hh);
      d.size = k * (d.gold ? 0.26 : 0.3);
      if (d.sx != null) { const dx = p.x - d.sx; if (Math.abs(dx) > 0.5) d.face = dx > 0 ? 1 : -1; }
      d.sx = p.x; d.sy = p.y;
      d.vis = p.depth > 0.15 && p.x > -d.size && p.x < W + d.size && p.y > -d.size && p.y < Hh + d.size;
      if (d.state === "fly") {
        const off = Math.acos(Math.max(-1, Math.min(1, p.depth)));
        if (!nearest || off < nearest.off) nearest = { d, off, p };
      }
      if (!d.vis) continue;
      duck(c, p.x, p.y, d.size, t, { face: d.face, gold: d.gold, rainbow: D.rainbow, hit: d.state === "hit", id: d.id });
      if (d.state === "fly" && Math.hypot(p.x - W / 2, p.y - Hh / 2) < ring + d.size * 0.25) lock = true;
      if (D.dizzy > 0 && d.state === "fly") P.star(c, p.x, p.y - d.size * 0.45, d.size * 0.07, P.rng(d.id), "#9b5de5");
      if (d.pop && d.pop.t < 1) {
        d.pop.t += dt;
        c.save();
        c.globalAlpha = 1 - d.pop.t;
        c.font = `bold ${Math.round(k * 0.07)}px 'Patrick Hand', cursive`;
        c.textAlign = "center"; c.lineWidth = 5; c.strokeStyle = "#fff"; c.fillStyle = "#7a3fd0";
        c.strokeText(d.pop.text, p.x, p.y - d.size * 0.5 - d.pop.t * 40);
        c.fillText(d.pop.text, p.x, p.y - d.size * 0.5 - d.pop.t * 40);
        c.restore();
      }
    }

    // the aiming circle: turns red when a duck is inside
    c.save();
    c.setLineDash(lock ? [] : [10, 10]);
    c.strokeStyle = lock ? "#e5484d" : A.state.noCamera ? "rgba(46,46,51,0.5)" : "rgba(255,255,255,0.9)";
    c.lineWidth = lock ? 6 : 4;
    c.beginPath(); c.arc(W / 2, Hh / 2, ring, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.moveTo(W / 2 - 12, Hh / 2); c.lineTo(W / 2 + 12, Hh / 2);
    c.moveTo(W / 2, Hh / 2 - 12); c.lineTo(W / 2, Hh / 2 + 12);
    c.stroke();
    c.restore();
    $("duck-shoot").classList.toggle("lock", lock);

    // shot flash
    if (D.flash > 0) {
      c.save();
      c.globalAlpha = D.flash / 0.18;
      c.fillStyle = "#fff7c2";
      c.beginPath(); c.arc(W / 2, Hh / 2, ring * (1.4 - D.flash * 2), 0, Math.PI * 2); c.fill();
      c.font = `bold ${Math.round(k * 0.12)}px 'Patrick Hand', cursive`;
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#e5484d";
      c.fillText("POP!", W / 2, Hh / 2);
      c.restore();
    }

    // no duck on screen: the arrow points the way
    if (nearest && !D.ducks.some((d) => d.state === "fly" && d.vis)) {
      let ax = nearest.p.dx, ay = -nearest.p.dy;
      if (nearest.p.depth < 0.3 && Math.abs(ax) < 0.2) ax = ax < 0 ? -1 : 1;
      const len = Math.hypot(ax, ay) || 1;
      ax /= len; ay /= len;
      const reach = k * 0.36 + Math.sin(t * 6) * k * 0.03;
      A.arrow(c, W / 2 + ax * reach, Hh / 2 + ay * reach, Math.atan2(ay, ax), k * 0.13, t);
      duck(c, W / 2 + ax * (reach - k * 0.17), Hh / 2 + ay * (reach - k * 0.17), k * 0.13, t, { face: ax < 0 ? -1 : 1, gold: nearest.d.gold });
    }
    if (D.between > 0 && !D.ducks.length && D.on) {
      c.save();
      c.font = `bold ${Math.round(k * 0.08)}px 'Patrick Hand', cursive`;
      c.textAlign = "center"; c.lineWidth = 6; c.strokeStyle = "#fff"; c.fillStyle = P.INK;
      const msg = D.wave ? "More ducks coming…" : "Get ready…";
      c.strokeText(msg, W / 2, Hh * 0.3); c.fillText(msg, W / 2, Hh * 0.3);
      c.restore();
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    $("btn-ducks").onclick = open;
    $("ducks-start").onclick = () => window.MazooleHunt.start("ducks");
    $("ducks-again").onclick = () => window.MazooleHunt.start("ducks");
    $("ducks-back").onclick = open;
    $("duck-shoot").addEventListener("pointerdown", (e) => { e.preventDefault(); shoot(); });
  });

  window.MazooleDucks = { open, begin, go, stopped, shoot, frame, quake, SECRETS, duck, _state: D, get records() { return rec; } };
})();
