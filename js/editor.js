// "Draw your own maze": paint a level with the mouse or a finger, then play it.
(function () {
  const P = window.Pencil;
  const STORE = "mazoole.myMaze";
  const SIZES = { small: [14, 10], medium: [20, 12], big: [26, 14] };
  const TOOLS = [
    ["#", "Wall"], [".", "Eraser"], ["1", "Hero"], ["2", "Fairy"], ["G", "Goal"],
    ["a", "Red button"], ["A", "Red door"], ["b", "Blue button"], ["B", "Blue door"],
    ["k", "Key"], ["L", "Lock"], ["w", "Wings"], ["*", "Star"], ["h", "Heart trap"],
    ["m", "Monster"], ["s", "Spider"], ["F", "Angry fairy"],
  ];
  const UNIQUE = new Set(["1", "2", "G"]);

  const E = { grid: null, tool: "#", name: "My maze", goal: "gift", painting: false, world: null, dirty: true, t: 0, tile: 32 };
  let canvas, ctx, staticCanvas;
  const $ = (id) => document.getElementById(id);

  function blank(w, h) {
    const g = [];
    for (let y = 0; y < h; y++) {
      g.push([]);
      for (let x = 0; x < w; x++) g[y].push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? "#" : ".");
    }
    g[1][1] = "1"; g[2][1] = "2"; g[h - 2][w - 2] = "G";
    return g;
  }

  function toDef(fromEditor) {
    return { name: E.name || "My maze", story: "A maze you drew yourself!", goal: E.goal, map: E.grid.map((r) => r.join("")), fromEditor };
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(toDef(false))); } catch (_) { /* private mode */ }
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE));
      if (d && Array.isArray(d.map) && d.map.length > 2) return d;
    } catch (_) { /* nothing saved */ }
    return null;
  }

  function open() {
    const M = window.Mazoole;
    M.G.mode = "edit";
    M.G.customDef = null;
    M.G.particles = [];
    $("hud-name").textContent = "Draw your own maze";
    const saved = load();
    if (!E.grid) {
      if (saved) { E.grid = saved.map.map((r) => r.split("")); E.name = saved.name; E.goal = saved.goal || "gift"; }
      else E.grid = blank(...SIZES.medium);
    }
    $("ed-name").value = E.name;
    $("ed-goal").value = E.goal;
    document.body.classList.add("editing");
    for (const el of document.querySelectorAll(".screen")) el.hidden = el.id !== "editor";
    E.dirty = true;
    resize();
  }

  function resize() {
    if (window.Mazoole.G.mode !== "edit") return;
    const stage = $("stage"), dpr = window.Mazoole.dpr;
    const h = E.grid.length, w = E.grid[0].length;
    E.tile = Math.max(12, Math.floor(Math.min(stage.clientWidth / w, stage.clientHeight / h)));
    canvas.style.width = E.tile * w + "px";
    canvas.style.height = E.tile * h + "px";
    canvas.width = staticCanvas.width = Math.round(E.tile * w * dpr);
    canvas.height = staticCanvas.height = Math.round(E.tile * h * dpr);
    E.dirty = true;
  }

  function render(dt) {
    const M = window.Mazoole, s = E.tile;
    E.t += dt;
    if (E.dirty) {
      E.world = M.parse(toDef());
      const hasFairy = E.grid.some((r) => r.includes("2"));
      E.world.playersList = E.world.starts.slice(0, hasFairy ? 2 : 1).map((st, i) => ({ id: i, fx: st[0], fy: st[1], facing: 1, flyT: 0, inv: 0 }));
      E.world.monsters.forEach((m) => { m.fx = m.x; m.fy = m.y; });
      M.drawStatic(E.world, s, staticCanvas.getContext("2d"));
      E.dirty = false;
    }
    ctx.setTransform(M.dpr, 0, 0, M.dpr, 0, 0);
    M.renderWorld(E.world, ctx, s, E.t, { staticCanvas });
    // light grid so little hands can see the squares
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let x = 1; x < E.grid[0].length; x++) { ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo(x * s, E.grid.length * s); ctx.stroke(); }
    for (let y = 1; y < E.grid.length; y++) { ctx.beginPath(); ctx.moveTo(0, y * s); ctx.lineTo(E.grid[0].length * s, y * s); ctx.stroke(); }
    ctx.restore();
  }

  function paintAt(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / E.tile), y = Math.floor((e.clientY - rect.top) / E.tile);
    const h = E.grid.length, w = E.grid[0].length;
    if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return; // the edge is always wall
    if (E.grid[y][x] === E.tool) return;
    if (UNIQUE.has(E.tool)) for (const row of E.grid) for (let i = 0; i < row.length; i++) if (row[i] === E.tool) row[i] = ".";
    E.grid[y][x] = E.tool;
    E.dirty = true;
    save();
  }

  function play() {
    const flat = E.grid.flat();
    if (!flat.includes("1")) return alert("Put the Hero (1) somewhere first!");
    if (!flat.includes("G")) return alert("Put the Goal somewhere first!");
    save();
    document.body.classList.remove("editing");
    window.Mazoole.UI.playCustom(toDef(true));
  }

  function copy() {
    const d = toDef(false);
    const text = `  {\n    name: ${JSON.stringify(d.name)},\n    story: ${JSON.stringify(d.story)},\n    goal: ${JSON.stringify(d.goal)},\n    map: [\n${d.map.map((r) => `      "${r}",`).join("\n")}\n    ],\n  },\n`;
    const done = () => { $("ed-copy").textContent = "Copied! ✓"; setTimeout(() => ($("ed-copy").textContent = "Copy level"), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt("Copy this into js/levels.js:", text));
    else prompt("Copy this into js/levels.js:", text);
  }

  function init() {
    canvas = $("game");
    ctx = canvas.getContext("2d");
    staticCanvas = document.createElement("canvas");

    const bar = $("ed-tools");
    for (const [ch, label] of TOOLS) {
      const b = document.createElement("button");
      b.className = "tool" + (ch === E.tool ? " on" : "");
      b.title = label;
      b.appendChild(toolIcon(ch));
      const span = document.createElement("span");
      span.textContent = label;
      b.appendChild(span);
      b.onclick = () => {
        E.tool = ch;
        for (const t of bar.children) t.classList.toggle("on", t === b);
      };
      bar.appendChild(b);
    }

    canvas.addEventListener("pointerdown", (e) => {
      if (window.Mazoole.G.mode !== "edit") return;
      E.painting = true;
      canvas.setPointerCapture(e.pointerId);
      paintAt(e);
    });
    canvas.addEventListener("pointermove", (e) => { if (E.painting) paintAt(e); });
    const stop = () => (E.painting = false);
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);

    $("ed-play").onclick = play;
    $("ed-copy").onclick = copy;
    $("ed-name").oninput = (e) => { E.name = e.target.value; save(); };
    $("ed-goal").onchange = (e) => { E.goal = e.target.value; E.dirty = true; save(); };
    $("ed-size").onchange = (e) => {
      if (!confirm("Start a new empty maze?")) { e.target.value = ""; return; }
      E.grid = blank(...SIZES[e.target.value]);
      e.target.value = "";
      save();
      resize();
    };
    $("ed-clear").onclick = () => {
      if (!confirm("Erase the whole maze?")) return;
      E.grid = blank(E.grid[0].length, E.grid.length);
      save();
      E.dirty = true;
    };
  }

  function toolIcon(ch) {
    const size = 30, c = document.createElement("canvas");
    c.width = c.height = size * 2;
    c.style.width = c.style.height = size + "px";
    const x = c.getContext("2d");
    x.scale(2, 2);
    const r = P.rng(P.hash(ch.charCodeAt(0), 1, 1)), s = size, m = s / 2;
    if (ch === "#") { x.fillStyle = "#cfcac0"; x.fillRect(3, 3, s - 6, s - 6); P.stroke(x, [[3, 3], [s - 3, 3], [s - 3, s - 3], [3, s - 3], [3, 3]], r, 1, 2); }
    else if (ch === ".") { x.font = `${s * 0.7}px sans-serif`; x.textAlign = "center"; x.fillText("⌫", m, s * 0.75); }
    else if (ch === "1") P.hero(x, m, m + 2, s * 0.9, 0, {});
    else if (ch === "2") P.fairy(x, m, m + 2, s * 0.9, 0, {});
    else if (ch === "G") P.gift(x, m, m, s, r);
    else if (ch === "a" || ch === "b") P.button(x, 0, 0, s, ch, false, 3);
    else if (ch === "A" || ch === "B") P.door(x, 0, 0, s, ch.toLowerCase(), false, 4);
    else if (ch === "k") P.key(x, m, m, s, r);
    else if (ch === "L") P.lockDoor(x, 0, 0, s, 5);
    else if (ch === "w") P.wingsShape(x, m, m, s, r, "rgba(200,170,255,0.8)", 0);
    else if (ch === "*") P.star(x, m, m, s * 0.35, r);
    else if (ch === "h") P.heartTrap(x, 0, 0, s, 0, 6);
    else if (ch === "m") P.monster(x, m, m, s, 0, 1);
    else if (ch === "s") P.spider(x, m, m, s, 0, 1);
    else if (ch === "F") P.angryFairy(x, m, m + 2, s * 0.9, 0, false);
    return c;
  }

  window.MazooleEditor = { open, render, resize, load };
  window.addEventListener("DOMContentLoaded", init);
})();
