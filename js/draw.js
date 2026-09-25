// Pencil & crayon drawing helpers. Everything is drawn with slightly wobbly
// lines so the game looks like it was sketched in a notebook.
// Sprites "boil" (re-wobble a few times per second) like hand-drawn cartoons.
(function () {
  const INK = "#2e2e33";
  const PAPER = "#fbf8f1";

  // Small seeded random generator so the same wall always wobbles the same way.
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  const hash = (a, b, c) => ((a * 73856093) ^ (b * 19349663) ^ ((c || 0) * 83492791)) >>> 0;

  // A wobbly pencil stroke through a list of points.
  function stroke(ctx, pts, r, wob, width, color, alpha) {
    ctx.save();
    ctx.strokeStyle = color || INK;
    ctx.lineWidth = width || 2;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const j = () => (r() - 0.5) * wob;
    ctx.moveTo(pts[0][0] + j(), pts[0][1] + j());
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      ctx.quadraticCurveTo((x0 + x1) / 2 + j() * 1.5, (y0 + y1) / 2 + j() * 1.5, x1 + j(), y1 + j());
    }
    ctx.stroke();
    ctx.restore();
  }

  // A long straight line drawn like a pencil: subdivided, wobbly, doubled.
  function pencilLine(ctx, x1, y1, x2, y2, r, s) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(2, Math.round(len / (s * 0.8)));
    for (let pass = 0; pass < 2; pass++) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
      }
      stroke(ctx, pts, r, s * 0.07, pass ? 1 : Math.max(1.6, s * 0.07), INK, pass ? 0.45 : 0.9);
    }
  }

  function ellipse(ctx, x, y, rx, ry, r, width, color, fill) {
    const pts = [];
    const start = r() * Math.PI * 2;
    for (let i = 0; i <= 12; i++) {
      const a = start + (i / 12) * Math.PI * 2.08;
      pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
    }
    if (fill) {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    stroke(ctx, pts, r, Math.max(rx, ry) * 0.12, width, color);
  }

  // Crayon scribble inside the current path.
  function crayon(ctx, x, y, w, h, color, r, alpha) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = alpha || 0.75;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, w * 0.06);
    ctx.beginPath();
    for (let i = -h; i < w + h; i += Math.max(2, w * 0.09)) {
      ctx.moveTo(x + i + (r() - 0.5) * 2, y);
      ctx.lineTo(x + i - h + (r() - 0.5) * 2, y + h);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- paper
  function paper(ctx, w, h, s) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(90,140,220,0.13)";
    ctx.lineWidth = 1;
    for (let y = s * 0.5; y < h; y += s * 0.5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(230,90,110,0.18)";
    ctx.beginPath(); ctx.moveTo(s * 0.35, 0); ctx.lineTo(s * 0.35, h); ctx.stroke();
  }

  // ---------------------------------------------------------------- maze walls
  // Walls are drawn the way a child draws corridors: outlines + light shading.
  function walls(ctx, grid, isSolid, s) {
    const h = grid.length, w = grid[0].length;
    const solid = (x, y) => x < 0 || y < 0 || x >= w || y >= h || isSolid(grid[y][x]);

    // light graphite shading inside walls
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const r = rng(hash(x, y, 7));
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const o = (i + r() * 0.5) * s / 4;
        ctx.moveTo(x * s + o, y * s + s - 1);
        ctx.lineTo(x * s + o + s * 0.35, y * s + 1);
      }
      ctx.stroke();
      ctx.restore();
    }
    // horizontal outlines, merged into long runs
    for (let y = 1; y < h; y++) {
      let run = -1;
      for (let x = 0; x <= w; x++) {
        const edge = x < w && solid(x, y - 1) !== solid(x, y);
        if (edge && run < 0) run = x;
        if (!edge && run >= 0) {
          pencilLine(ctx, run * s, y * s, x * s, y * s, rng(hash(run, y, 1)), s);
          run = -1;
        }
      }
    }
    for (let x = 1; x < w; x++) {
      let run = -1;
      for (let y = 0; y <= h; y++) {
        const edge = y < h && solid(x - 1, y) !== solid(x, y);
        if (edge && run < 0) run = y;
        if (!edge && run >= 0) {
          pencilLine(ctx, x * s, run * s, x * s, y * s, rng(hash(x, run, 2)), s);
          run = -1;
        }
      }
    }
  }

  // ---------------------------------------------------------------- tiles
  const DOOR_COLORS = { a: "#e5484d", b: "#3e7bfa", c: "#2fae62", x: "#9b5de5" };

  function door(ctx, x, y, s, letter, open, seed) {
    const r = rng(seed);
    const c = DOOR_COLORS[letter] || "#8a5a2b";
    const px = x * s + s * 0.08, py = y * s + s * 0.08, w = s * 0.84;
    if (open) {
      ctx.save();
      ctx.setLineDash([s * 0.08, s * 0.1]);
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, w, w);
      ctx.restore();
      return;
    }
    ctx.beginPath(); ctx.rect(px, py, w, w);
    crayon(ctx, px, py, w, w, c, r, 0.55);
    stroke(ctx, [[px, py], [px + w, py], [px + w, py + w], [px, py + w], [px, py]], r, s * 0.05, 2);
    for (let i = 1; i < 3; i++) stroke(ctx, [[px + (w * i) / 3, py + 2], [px + (w * i) / 3, py + w - 2]], r, s * 0.04, 1.2);
    ellipse(ctx, px + w * 0.8, py + w * 0.55, s * 0.05, s * 0.05, r, 1.5, INK, INK);
  }

  function lockDoor(ctx, x, y, s, seed) {
    const r = rng(seed);
    const px = x * s + s * 0.08, py = y * s + s * 0.08, w = s * 0.84;
    ctx.beginPath(); ctx.rect(px, py, w, w);
    crayon(ctx, px, py, w, w, "#a0714a", r, 0.5);
    // the scribbled door from the drawing
    ctx.save();
    ctx.globalAlpha = 0.6;
    const pts = [];
    for (let i = 0; i < 14; i++) pts.push([px + w * (0.2 + r() * 0.6), py + w * (0.2 + r() * 0.6)]);
    stroke(ctx, pts, r, 2, 1, INK);
    ctx.restore();
    stroke(ctx, [[px, py], [px + w, py], [px + w, py + w], [px, py + w], [px, py]], r, s * 0.05, 2);
    ellipse(ctx, px + w / 2, py + w * 0.42, s * 0.09, s * 0.09, r, 2, INK, "#f5d33b");
    stroke(ctx, [[px + w / 2, py + w * 0.5], [px + w / 2, py + w * 0.72]], r, 0, 3);
  }

  function button(ctx, x, y, s, letter, pressed, seed) {
    const r = rng(seed);
    const cx = x * s + s / 2, cy = y * s + s / 2;
    const c = DOOR_COLORS[letter] || "#999";
    // the little picture frame from the drawing
    stroke(ctx, [[cx - s * 0.36, cy - s * 0.36], [cx + s * 0.36, cy - s * 0.36], [cx + s * 0.36, cy + s * 0.36], [cx - s * 0.36, cy + s * 0.36], [cx - s * 0.36, cy - s * 0.36]], r, s * 0.04, 1.3, INK, 0.7);
    ellipse(ctx, cx, cy, s * 0.24, s * (pressed ? 0.12 : 0.22), r, 2, INK, c);
    if (!pressed) ellipse(ctx, cx - s * 0.07, cy - s * 0.07, s * 0.05, s * 0.04, r, 1, "#fff", "#fff");
  }

  // Purple floor plate: only works while someone stands on it
  function plate(ctx, x, y, s, pressed, seed) {
    const r = rng(seed);
    const px = x * s + s * 0.14, py = y * s + s * (pressed ? 0.3 : 0.22), w = s * 0.72, h = s * (pressed ? 0.46 : 0.54);
    ctx.beginPath(); ctx.rect(px, py, w, h);
    crayon(ctx, px, py, w, h, DOOR_COLORS.x, r, pressed ? 0.35 : 0.6);
    stroke(ctx, [[px, py], [px + w, py], [px + w, py + h], [px, py + h], [px, py]], r, s * 0.04, 2);
    // two little footprints: "stand here!"
    for (const o of [-0.12, 0.12]) ellipse(ctx, px + w / 2 + o * s, py + h / 2, s * 0.06, s * 0.1, r, 1.2, INK, pressed ? DOOR_COLORS.x : PAPER);
  }

  function key(ctx, cx, cy, s, r) {
    // yellow crayon key (the girl in the drawing holds a yellow thing!)
    ctx.beginPath(); ctx.arc(cx - s * 0.16, cy, s * 0.15, 0, Math.PI * 2);
    crayon(ctx, cx - s * 0.32, cy - s * 0.16, s * 0.32, s * 0.32, "#f5d33b", r, 0.95);
    ellipse(ctx, cx - s * 0.16, cy, s * 0.15, s * 0.15, r, 2);
    ellipse(ctx, cx - s * 0.16, cy, s * 0.05, s * 0.05, r, 1.2, INK, PAPER);
    stroke(ctx, [[cx - s * 0.01, cy], [cx + s * 0.32, cy]], r, 1, 3, "#c49b00");
    stroke(ctx, [[cx + s * 0.22, cy], [cx + s * 0.22, cy + s * 0.12]], r, 1, 2.5, "#c49b00");
    stroke(ctx, [[cx + s * 0.31, cy], [cx + s * 0.31, cy + s * 0.1]], r, 1, 2.5, "#c49b00");
  }

  function wingsShape(ctx, cx, cy, s, r, color, flap) {
    const f = 1 + (flap || 0) * 0.25;
    for (const side of [-1, 1]) {
      ellipse(ctx, cx + side * s * 0.2 * f, cy - s * 0.1, s * 0.2 * f, s * 0.15, r, 1.5, INK, color);
      ellipse(ctx, cx + side * s * 0.17 * f, cy + s * 0.13, s * 0.15 * f, s * 0.11, r, 1.5, INK, color);
    }
  }

  function star(ctx, cx, cy, rad, r, color) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? rad * 0.45 : rad;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    crayon(ctx, cx - rad, cy - rad, rad * 2, rad * 2, color || "#ffc93c", r, 0.9);
    stroke(ctx, pts, r, rad * 0.08, 1.8);
  }

  function heartPath(ctx, cx, cy, k) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + k * 0.35);
    ctx.bezierCurveTo(cx - k * 0.55, cy - k * 0.05, cx - k * 0.3, cy - k * 0.45, cx, cy - k * 0.18);
    ctx.bezierCurveTo(cx + k * 0.3, cy - k * 0.45, cx + k * 0.55, cy - k * 0.05, cx, cy + k * 0.35);
  }

  function heart(ctx, cx, cy, k, r, color, broken) {
    heartPath(ctx, cx, cy, k);
    crayon(ctx, cx - k, cy - k, k * 2, k * 2, color || "#ff5c7a", r, 0.9);
    heartPath(ctx, cx, cy, k);
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    if (broken) stroke(ctx, [[cx, cy - k * 0.18], [cx - k * 0.1, cy - k * 0.02], [cx + k * 0.08, cy + k * 0.08], [cx - k * 0.05, cy + k * 0.2], [cx, cy + k * 0.35]], r, 0, 1.8, PAPER);
  }

  function heartTrap(ctx, x, y, s, t, seed) {
    // the staircase with the broken heart
    const r = rng(seed);
    const px = x * s, py = y * s;
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
      const o = s * (0.1 + i * 0.1);
      stroke(ctx, [[px + o, py + s - o * 0.5], [px + o, py + o], [px + s - o * 0.5, py + o]], r, 1, 1);
    }
    ctx.restore();
    const pulse = 1 + Math.sin(t * 4 + x) * 0.05;
    heart(ctx, px + s * 0.55, py + s * 0.58, s * 0.62 * pulse, rng(seed + 1), "#b5405a", true);
  }

  function gift(ctx, cx, cy, s, r, open) {
    // the red door / present at the end of Bina's corridor
    const w = s * 0.7, px = cx - w / 2, py = cy - w / 2 + s * 0.05;
    ctx.beginPath(); ctx.rect(px, py, w, w * 0.85);
    crayon(ctx, px, py, w, w, "#e5484d", r, 0.85);
    stroke(ctx, [[px, py], [px + w, py], [px + w, py + w * 0.85], [px, py + w * 0.85], [px, py]], r, 1.5, 2);
    stroke(ctx, [[cx, py], [cx, py + w * 0.85]], r, 1, 3, "#f5d33b");
    stroke(ctx, [[px, py + w * 0.35], [px + w, py + w * 0.35]], r, 1, 3, "#f5d33b");
    const lift = open ? -s * 0.25 : 0;
    ellipse(ctx, cx - s * 0.12, py - s * 0.08 + lift, s * 0.12, s * 0.08, r, 2, INK, "#f5d33b");
    ellipse(ctx, cx + s * 0.12, py - s * 0.08 + lift, s * 0.12, s * 0.08, r, 2, INK, "#f5d33b");
  }

  // ---------------------------------------------------------------- characters
  function face(ctx, cx, cy, k, r, mood) {
    ellipse(ctx, cx - k * 0.3, cy - k * 0.1, k * 0.07, k * 0.09, r, 1.5, INK, INK);
    ellipse(ctx, cx + k * 0.3, cy - k * 0.1, k * 0.07, k * 0.09, r, 1.5, INK, INK);
    if (mood === "angry") {
      stroke(ctx, [[cx - k * 0.5, cy - k * 0.4], [cx - k * 0.15, cy - k * 0.25]], r, 0.5, 1.8);
      stroke(ctx, [[cx + k * 0.5, cy - k * 0.4], [cx + k * 0.15, cy - k * 0.25]], r, 0.5, 1.8);
    }
    const my = cy + k * 0.35;
    if (mood === "happy") stroke(ctx, [[cx - k * 0.3, my - k * 0.08], [cx, my + k * 0.1], [cx + k * 0.3, my - k * 0.08]], r, 0.5, 1.6);
    else stroke(ctx, [[cx - k * 0.25, my + k * 0.08], [cx, my - k * 0.06], [cx + k * 0.25, my + k * 0.08]], r, 0.5, 1.6);
  }

  // Player 1: the stick-figure hero with a cape (bottom-left of the castle drawing)
  function hero(ctx, cx, cy, s, t, o) {
    const r = rng(hash(Math.floor(t * 6), 11, 1));
    const bob = o.moving ? Math.sin(t * 16) * s * 0.03 : 0;
    const lift = o.flying ? -s * 0.18 + Math.sin(t * 6) * s * 0.04 : 0;
    const y = cy + bob + lift;
    const dir = o.facing || 1;
    if (o.flying) shadow(ctx, cx, cy + s * 0.38, s);
    // cape
    ctx.beginPath();
    ctx.moveTo(cx, y - s * 0.12);
    ctx.lineTo(cx - dir * s * (0.42 + (o.moving ? Math.sin(t * 12) * 0.05 : 0)), y + s * 0.26);
    ctx.lineTo(cx - dir * s * 0.05, y + s * 0.18);
    ctx.closePath();
    crayon(ctx, cx - s * 0.5, y - s * 0.2, s, s * 0.5, o.color || "#e5484d", r, 0.8);
    stroke(ctx, [[cx, y - s * 0.12], [cx - dir * s * 0.42, y + s * 0.26], [cx - dir * s * 0.05, y + s * 0.18]], r, 1, 1.5);
    // body
    const step = o.moving ? Math.sin(t * 16) * s * 0.1 : 0;
    stroke(ctx, [[cx, y - s * 0.14], [cx, y + s * 0.14]], r, 1, 2);
    stroke(ctx, [[cx, y + s * 0.14], [cx - s * 0.12 + step, y + s * 0.36]], r, 1, 2);
    stroke(ctx, [[cx, y + s * 0.14], [cx + s * 0.12 - step, y + s * 0.36]], r, 1, 2);
    stroke(ctx, [[cx - s * 0.2, y - s * 0.02 - step * 0.5], [cx, y - s * 0.08], [cx + s * 0.22, y - s * 0.12 + step * 0.5]], r, 1, 2);
    // head
    ellipse(ctx, cx, y - s * 0.28, s * 0.15, s * 0.15, r, 2, INK, PAPER);
    face(ctx, cx + dir * s * 0.02, y - s * 0.28, s * 0.14, r, o.hurt ? "sad" : "happy");
    if (o.flying) wingsShape(ctx, cx, y - s * 0.02, s * 0.9, r, "rgba(170,220,255,0.7)", Math.sin(t * 20));
  }

  // Player 2: the girl with long hair and butterfly wings
  function fairy(ctx, cx, cy, s, t, o) {
    const r = rng(hash(Math.floor(t * 6), 12, 2));
    const bob = o.moving ? Math.sin(t * 16) * s * 0.03 : 0;
    const lift = o.flying ? -s * 0.18 + Math.sin(t * 6) * s * 0.04 : 0;
    const y = cy + bob + lift;
    const dir = o.facing || 1;
    if (o.flying) shadow(ctx, cx, cy + s * 0.38, s);
    wingsShape(ctx, cx, y + s * 0.02, s * (o.flying ? 1 : 0.75), r, o.color || "rgba(200,140,255,0.75)", o.flying ? Math.sin(t * 20) : Math.sin(t * 3) * 0.2);
    // long hair
    stroke(ctx, [[cx - dir * s * 0.1, y - s * 0.42], [cx - dir * s * 0.28, y - s * 0.3], [cx - dir * s * 0.3, y - s * 0.05], [cx - dir * s * 0.2, y + s * 0.12]], r, 1, 2, "#6b4a2b");
    // dress
    ctx.beginPath();
    ctx.moveTo(cx, y - s * 0.12);
    ctx.lineTo(cx - s * 0.16, y + s * 0.22);
    ctx.lineTo(cx + s * 0.16, y + s * 0.22);
    ctx.closePath();
    crayon(ctx, cx - s * 0.2, y - s * 0.15, s * 0.4, s * 0.4, "#ff8fc1", r, 0.85);
    stroke(ctx, [[cx, y - s * 0.12], [cx - s * 0.16, y + s * 0.22], [cx + s * 0.16, y + s * 0.22], [cx, y - s * 0.12]], r, 1, 1.5);
    const step = o.moving ? Math.sin(t * 16) * s * 0.07 : 0;
    stroke(ctx, [[cx - s * 0.06, y + s * 0.22], [cx - s * 0.08 + step, y + s * 0.37]], r, 1, 2);
    stroke(ctx, [[cx + s * 0.06, y + s * 0.22], [cx + s * 0.08 - step, y + s * 0.37]], r, 1, 2);
    ellipse(ctx, cx, y - s * 0.26, s * 0.15, s * 0.15, r, 2, INK, "#fde7d4");
    stroke(ctx, [[cx - s * 0.15, y - s * 0.32], [cx - s * 0.02, y - s * 0.43], [cx + s * 0.15, y - s * 0.32]], r, 1, 2.5, "#6b4a2b");
    face(ctx, cx + dir * s * 0.02, y - s * 0.25, s * 0.14, r, o.hurt ? "sad" : "happy");
  }

  function shadow(ctx, cx, cy, s) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.22, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // The spiky monster with teeth from Bina's corridor
  function monster(ctx, cx, cy, s, t, id) {
    const r = rng(hash(Math.floor(t * 6), id, 3));
    const k = s * 0.36;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = i % 2 ? k * 0.75 : k * 1.05;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    crayon(ctx, cx - k * 1.1, cy - k * 1.1, k * 2.2, k * 2.2, "#7bc96f", r, 0.7);
    stroke(ctx, pts, r, 1.5, 2);
    face(ctx, cx, cy - k * 0.25, k * 0.8, r, "angry");
    const teeth = [];
    for (let i = 0; i <= 6; i++) teeth.push([cx - k * 0.45 + (i * k * 0.9) / 6, cy + k * (i % 2 ? 0.2 : 0.45)]);
    stroke(ctx, teeth, r, 0.5, 1.5);
  }

  function spider(ctx, cx, cy, s, t, id) {
    const r = rng(hash(Math.floor(t * 6), id, 4));
    const k = s * 0.2;
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const a = (-0.6 + i * 0.4) + Math.sin(t * 14 + i) * 0.12;
      stroke(ctx, [[cx, cy], [cx + side * k * 1.6 * Math.cos(a), cy + k * 1.2 * Math.sin(a) - k * 0.4], [cx + side * k * 2.2 * Math.cos(a), cy + k * 1.8 * Math.sin(a) + k * 0.3]], r, 1, 1.5);
    }
    ellipse(ctx, cx, cy, k, k * 0.9, r, 2, INK, "#3a3440");
    ellipse(ctx, cx - k * 0.35, cy - k * 0.2, k * 0.2, k * 0.2, r, 1, INK, "#fff");
    ellipse(ctx, cx + k * 0.35, cy - k * 0.2, k * 0.2, k * 0.2, r, 1, INK, "#fff");
  }

  // The big angry fairy who shoots a beam
  function angryFairy(ctx, cx, cy, s, t, charging) {
    const r = rng(hash(Math.floor(t * 6), 13, 5));
    wingsShape(ctx, cx, cy + s * 0.05, s * 1.05, r, "rgba(255,170,90,0.7)", Math.sin(t * 5) * 0.4);
    stroke(ctx, [[cx - s * 0.08, cy - s * 0.4], [cx + s * 0.28, cy - s * 0.32], [cx + s * 0.32, cy - s * 0.02], [cx + s * 0.22, cy + s * 0.2]], r, 1, 2.2, "#6b4a2b");
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.1); ctx.lineTo(cx - s * 0.18, cy + s * 0.34); ctx.lineTo(cx + s * 0.18, cy + s * 0.34); ctx.closePath();
    crayon(ctx, cx - s * 0.2, cy - s * 0.12, s * 0.4, s * 0.5, "#c9a27a", r, 0.8);
    stroke(ctx, [[cx, cy - s * 0.1], [cx - s * 0.18, cy + s * 0.34], [cx + s * 0.18, cy + s * 0.34], [cx, cy - s * 0.1]], r, 1, 1.5);
    ellipse(ctx, cx, cy - s * 0.24, s * 0.16, s * 0.16, r, 2, INK, "#fde7d4");
    face(ctx, cx, cy - s * 0.24, s * 0.15, r, "angry");
    if (charging) {
      ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(t * 30) * 0.4;
      star(ctx, cx + s * 0.3, cy - s * 0.35, s * 0.1, r, "#ffe066");
      ctx.restore();
    }
  }

  function beam(ctx, cells, s, t, dx, dy) {
    if (!cells.length) return;
    const r = rng(hash(Math.floor(t * 20), 99, 6));
    const a = cells[0], b = cells[cells.length - 1];
    const x1 = a[0] * s + s / 2 - dx * s * 0.5, y1 = a[1] * s + s / 2 - dy * s * 0.5;
    const x2 = b[0] * s + s / 2 + dx * s * 0.5, y2 = b[1] * s + s / 2 + dy * s * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#ffcc33";
    ctx.lineWidth = s * 0.4;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const pts = [];
      const n = cells.length * 2 + 1;
      for (let j = 0; j <= n; j++) {
        const u = j / n;
        pts.push([x1 + (x2 - x1) * u + (r() - 0.5) * s * 0.25 * Math.abs(dy), y1 + (y2 - y1) * u + (r() - 0.5) * s * 0.25 * Math.abs(dx)]);
      }
      stroke(ctx, pts, r, 2, 1.5, i ? "#ff9f1c" : "#e0567a", 0.9);
    }
    for (const c of cells) if (r() < 0.4) star(ctx, c[0] * s + s * r(), c[1] * s + s * r(), s * 0.08, r, "#fff3a0");
  }

  // The friend waiting in bed (goal of the tower level)
  function friendInBed(ctx, cx, cy, s, t, happy) {
    const r = rng(hash(Math.floor(t * 4), 14, 7));
    ctx.beginPath(); ctx.rect(cx - s * 0.45, cy - s * 0.05, s * 0.9, s * 0.4);
    crayon(ctx, cx - s * 0.45, cy - s * 0.05, s * 0.9, s * 0.4, "#9ad0f5", r, 0.7);
    stroke(ctx, [[cx - s * 0.45, cy + s * 0.35], [cx - s * 0.45, cy - s * 0.2], [cx - s * 0.45, cy - s * 0.05], [cx + s * 0.45, cy - s * 0.05], [cx + s * 0.45, cy + s * 0.35]], r, 1, 2);
    ellipse(ctx, cx - s * 0.18, cy - s * 0.2, s * 0.17, s * 0.17, r, 2, INK, "#fde7d4");
    stroke(ctx, [[cx - s * 0.36, cy - s * 0.3], [cx - s * 0.2, cy - s * 0.4], [cx + s * 0.02, cy - s * 0.3]], r, 1, 3, "#6b4a2b");
    face(ctx, cx - s * 0.18, cy - s * 0.2, s * 0.15, r, happy ? "happy" : "sad");
    if (!happy) {
      const ty = ((t * 0.8) % 1) * s * 0.15;
      ellipse(ctx, cx - s * 0.26, cy - s * 0.12 + ty, s * 0.025, s * 0.04, r, 1, "#3e7bfa", "#9ad0f5");
      ctx.save(); ctx.font = `${s * 0.3}px 'Patrick Hand', cursive`; ctx.fillStyle = INK; ctx.globalAlpha = 0.7;
      ctx.fillText("help!", cx + s * 0.05, cy - s * 0.35); ctx.restore();
    } else heart(ctx, cx + s * 0.2, cy - s * 0.4, s * 0.35, r, "#ff5c7a");
  }

  window.Pencil = {
    INK, PAPER, DOOR_COLORS, rng, hash, stroke, ellipse, paper, walls, door, lockDoor, button, plate,
    key, wingsShape, star, heart, heartTrap, gift, hero, fairy, monster, spider, angryFairy,
    beam, friendInBed,
  };
})();
