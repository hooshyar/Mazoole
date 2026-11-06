// The power bag: treasures found in the treasure hunt are kept here (in this
// browser) and can be used in any maze by tapping them at the top of the screen.
(function () {
  const P = window.Pencil;
  const STORE = "mazoole.powers";
  const MAX_EACH = 9;
  const $ = (id) => document.getElementById(id);

  const POWERS = [
    { kind: "star", name: "Star", what: "Nothing can hurt you for 7 seconds", icon: (c, k) => P.star(c, k / 2, k / 2, k * 0.4, P.rng(1)) },
    { kind: "key", name: "Key", what: "An extra key for a lock door", icon: (c, k) => P.key(c, k / 2, k / 2, k * 1.05, P.rng(2)) },
    { kind: "wings", name: "Wings", what: "Fly over walls for 6 seconds", icon: (c, k) => P.wingsShape(c, k / 2, k / 2, k * 1.2, P.rng(3), "rgba(200,140,255,0.85)", 0.3) },
    { kind: "candy", name: "Candy", what: "50 points", icon: (c, k) => P.candy(c, k / 2, k / 2, k * 1.5, P.rng(4), 0) },
    { kind: "heart", name: "Heart", what: "One more heart", icon: (c, k) => P.heart(c, k / 2, k / 2, k * 0.8, P.rng(5), "#ff5c7a") },
    { kind: "gift", name: "Magic gift", what: "Opens every colored door", icon: (c, k) => P.gift(c, k / 2, k / 2, k * 1.1, P.rng(6), false) },
  ];

  function load() {
    try { const d = JSON.parse(localStorage.getItem(STORE)); if (d && typeof d === "object") return d; } catch (_) { /* first time */ }
    return {};
  }
  let bag = load();
  function save() { try { localStorage.setItem(STORE, JSON.stringify(bag)); } catch (_) { /* private mode */ } }

  const count = (kind) => bag[kind] || 0;
  const total = () => POWERS.reduce((n, p) => n + count(p.kind), 0);

  function add(kind) {
    if (!POWERS.some((p) => p.kind === kind)) return;
    bag[kind] = Math.min(MAX_EACH, count(kind) + 1);
    save();
    render();
  }

  function use(kind) {
    if (!count(kind)) return;
    const M = window.Mazoole;
    if (!M || !M.usePower) return;
    const info = POWERS.find((p) => p.kind === kind);
    if (M.G.mode !== "play") { M.UI.toast("Use your powers while you play a maze!"); return; }
    if (!M.usePower(kind)) { M.UI.toast(kind === "heart" ? "Your hearts are full!" : "There are no closed doors here."); return; }
    bag[kind] = count(kind) - 1;
    save();
    render();
    M.UI.toast(`${info.name}! ${info.what}.`);
  }

  function icon(p, size) {
    const c = document.createElement("canvas");
    c.width = c.height = size * 2;
    c.style.width = c.style.height = size + "px";
    const x = c.getContext("2d");
    x.scale(2, 2);
    p.icon(x, size);
    return c;
  }

  // HUD buttons while playing, and a summary line in the menu
  function render() {
    const hud = $("hud-powers");
    if (hud) {
      hud.innerHTML = "";
      for (const p of POWERS) {
        if (!count(p.kind)) continue;
        const b = document.createElement("button");
        b.className = "small power";
        b.title = `${p.name}: ${p.what}`;
        b.appendChild(icon(p, 24));
        const n = document.createElement("b");
        n.textContent = count(p.kind);
        b.appendChild(n);
        b.onclick = (e) => { e.currentTarget.blur(); use(p.kind); };
        hud.appendChild(b);
      }
      hud.hidden = !total();
    }
    const line = $("power-line");
    if (line) {
      line.innerHTML = "";
      if (!total()) { line.hidden = true; return; }
      line.hidden = false;
      line.append("🎒 Power bag:");
      for (const p of POWERS) {
        if (!count(p.kind)) continue;
        const s = document.createElement("span");
        s.title = `${p.name}: ${p.what}`;
        s.appendChild(icon(p, 26));
        s.append("×" + count(p.kind));
        line.appendChild(s);
      }
    }
  }

  window.addEventListener("DOMContentLoaded", render);
  window.MazoolePowers = { POWERS, add, use, count, total, render, icon };
})();
