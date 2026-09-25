// Progress: best scores, medals and the sticker book. Saved in this browser.
(function () {
  const P = window.Pencil;
  const STORE = "mazoole.progress";
  const $ = (id) => document.getElementById(id);

  // Stickers are awards. `test` looks at the running totals (and the level
  // just finished, when there is one).
  const STICKERS = [
    { id: "first", name: "First Adventure", how: "Finish any maze", test: (s) => s.wins >= 1, icon: (c, k) => P.gift(c, k / 2, k / 2, k * 0.9, P.rng(1)) },
    { id: "untouchable", name: "Untouchable", how: "Finish a maze without an ouch", test: (s, r) => r && r.hurts === 0, icon: (c, k) => P.heart(c, k / 2, k * 0.55, k * 0.9, P.rng(2), "#ff5c7a") },
    { id: "stars", name: "Star Hunter", how: "Collect every star in a maze", test: (s, r) => r && r.starsTotal > 0 && r.stars === r.starsTotal, icon: (c, k) => P.star(c, k / 2, k / 2, k * 0.36, P.rng(3)) },
    { id: "speedy", name: "Lightning Feet", how: "Beat the clock in a maze", test: (s, r) => r && r.time <= r.par, icon: (c, k) => { P.hero(c, k / 2, k * 0.55, k * 0.85, 0, { moving: true }); } },
    { id: "perfect", name: "Perfect!", how: "Win all 3 medals in one go", test: (s, r) => r && r.medalsNow === 7, icon: (c, k) => P.medal(c, k / 2, k * 0.6, k * 0.45, true) },
    { id: "friends", name: "Best Friends", how: "Finish a two-player puzzle", test: (s, r) => r && r.coop, icon: (c, k) => { P.hero(c, k * 0.32, k * 0.55, k * 0.6, 0, {}); P.fairy(c, k * 0.7, k * 0.55, k * 0.6, 0, {}); } },
    { id: "sky", name: "Sky Dancer", how: "Fly with wings 10 times", test: (s) => s.flights >= 10, icon: (c, k) => P.wingsShape(c, k / 2, k / 2, k * 1.1, P.rng(4), "rgba(200,170,255,0.9)", 0.5) },
    { id: "portal", name: "Portal Hopper", how: "Jump through portals 15 times", test: (s) => s.ports >= 15, icon: (c, k) => P.portal(c, k / 2, k / 2, k, 1, 4) },
    { id: "skater", name: "Ice Skater", how: "Slide 50 squares on ice", test: (s) => s.slides >= 50, icon: (c, k) => { c.fillStyle = "rgba(150,205,245,0.8)"; c.fillRect(k * 0.15, k * 0.15, k * 0.7, k * 0.7); P.stroke(c, [[k * 0.3, k * 0.45], [k * 0.6, k * 0.3]], P.rng(5), 1, 2, "#fff"); } },
    { id: "candy", name: "Sweet Tooth", how: "Eat 150 candies", test: (s) => s.candy >= 150, icon: (c, k) => P.candy(c, k / 2, k / 2, k * 1.6, P.rng(6), 0) },
    { id: "combo", name: "Candy Combo", how: "Get a x5 candy combo", test: (s) => s.bestCombo >= 5, icon: (c, k) => { P.candy(c, k * 0.35, k * 0.4, k * 1.1, P.rng(7), 1); P.candy(c, k * 0.65, k * 0.62, k * 1.1, P.rng(8), 2); } },
    { id: "ghost", name: "Ghost Buster", how: "Escape a ghost maze without getting caught", test: (s, r) => r && r.hasGhost && r.caught === 0, icon: (c, k) => P.ghost(c, k / 2, k / 2, k, 0, 1, true) },
    { id: "artist", name: "Little Artist", how: "Play a maze you drew yourself", test: (s) => s.ownPlays >= 1, icon: (c, k) => P.stroke(c, [[k * 0.2, k * 0.8], [k * 0.4, k * 0.3], [k * 0.6, k * 0.7], [k * 0.8, k * 0.2]], P.rng(9), 1, 3, "#e5484d") },
    { id: "master", name: "Medal Master", how: "Collect 20 medals", test: (s) => s.medals >= 20, icon: (c, k) => { P.medal(c, k * 0.33, k * 0.62, k * 0.3, true); P.medal(c, k * 0.67, k * 0.62, k * 0.3, true); } },
  ];

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE));
      if (d && d.levels) return d;
    } catch (_) { /* first time */ }
    return { levels: {}, stickers: {}, totals: {} };
  }
  let data = load();
  function save() { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (_) { /* private mode */ } }

  const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
  function totals() {
    const t = Object.assign({ wins: 0, flights: 0, ports: 0, slides: 0, candy: 0, bestCombo: 0, ownPlays: 0 }, data.totals);
    t.medals = Object.values(data.levels).reduce((n, l) => n + bits(l.medals || 0), 0);
    return t;
  }
  const levelKey = (def) => def.name;

  // Newly earned stickers (not yet celebrated)
  function checkStickers(result) {
    const t = totals(), fresh = [];
    for (const s of STICKERS) {
      if (data.stickers[s.id]) continue;
      if (s.test(t, result)) { data.stickers[s.id] = Date.now(); fresh.push(s); }
    }
    if (fresh.length) save();
    return fresh;
  }

  // Count something that happened while playing (flights, portals, ...)
  function bump(stat, n) {
    data.totals[stat] = (data.totals[stat] || 0) + (n || 1);
    save();
    return checkStickers(null);
  }
  function best(stat, v) {
    if ((data.totals[stat] || 0) >= v) return [];
    data.totals[stat] = v;
    save();
    return checkStickers(null);
  }

  // A level was finished: store medals and score, hand back what's new.
  function finish(def, result) {
    const key = levelKey(def);
    const rec = data.levels[key] || { medals: 0, best: 0 };
    const before = rec.medals;
    rec.medals |= result.medalsNow;
    const isBest = result.score > rec.best;
    if (isBest) rec.best = result.score;
    data.levels[key] = rec;
    data.totals.wins = (data.totals.wins || 0) + 1;
    save();
    const stickers = checkStickers(result);
    return { isBest, newMedals: rec.medals & ~before, stickers, best: rec.best };
  }

  function levelInfo(def) { return data.levels[levelKey(def)] || { medals: 0, best: 0 }; }
  const medalCount = () => totals().medals;
  const unlocked = (def) => !def.bonus || medalCount() >= def.bonus;

  function stickerCanvas(s, size, got) {
    const c = document.createElement("canvas");
    c.width = c.height = size * 2;
    c.style.width = c.style.height = size + "px";
    const x = c.getContext("2d");
    x.scale(2, 2);
    if (!got) x.globalAlpha = 0.18;
    try { s.icon(x, size); } catch (_) { /* a sticker that can't draw stays blank */ }
    return c;
  }

  function openBook() {
    const grid = $("sticker-grid");
    grid.innerHTML = "";
    let n = 0;
    for (const s of STICKERS) {
      const got = !!data.stickers[s.id];
      if (got) n++;
      const cell = document.createElement("div");
      cell.className = "sticker" + (got ? " got" : "");
      cell.appendChild(stickerCanvas(s, 58, got));
      const label = document.createElement("div");
      label.innerHTML = `<b>${got ? s.name : "???"}</b><span>${s.how}</span>`;
      cell.appendChild(label);
      grid.appendChild(cell);
    }
    $("sticker-count").textContent = `${n} of ${STICKERS.length} stickers`;
    for (const el of document.querySelectorAll(".screen")) el.hidden = el.id !== "stickers";
  }

  window.addEventListener("DOMContentLoaded", () => { $("btn-stickers").onclick = openBook; });

  window.MazooleProgress = { finish, bump, best, levelInfo, medalCount, unlocked, openBook, stickerCanvas, bits, STICKERS };
})();
