// Treasure hunt: print the treasure cards, hide them around the house, then
// find them with the phone's camera. When the camera sees a card, its treasure
// pops out on top of the paper and the fairy flies around it.
//
// Each card carries a small QR code ("MAZOOLE:1" ... "MAZOOLE:6"). Android
// Chrome reads QR codes natively (BarcodeDetector); other browsers fall back
// to js/vendor/jsQR.js, which is only loaded when needed.
(function () {
  const P = window.Pencil;
  const $ = (id) => document.getElementById(id);
  const STORE = "mazoole.hunt";
  const CLUE = (n) => "hunt" + n; // recorded clue for card n, kept by js/voices.js

  // QR codes for the six cards (version 1, error correction H), one hex number per row.
  // Made with: qrcode.QRCode(version=1, error_correction=H, border=0).add_data("MAZOOLE:n")
  const QR = [
    "1fdd7f104c4117575d174a5d17565d1048411fd57f00120000c3551f0959015ea50b914d1966300014db1fce69105ed51747ee174fa41744f31049ed1fc4cc",
    "1fc17f104941175d5d175f5d174a5d104c411fd57f00090003610c16bd590f4f6c1b9f55045f300016481fd09b104155175ae71754fc174233104d6e1fc0de",
    "1fca7f105041175b5d175f5d17565d105a411fd57f000a0004f4be0a8fcc15683e1c9c090dfef000181f1fde92105a00174835174aa0175ab31048691fc297",
    "1fcf7f104a41175c5d17575d174f5d1045411fd57f000800036a0c070f591f552c1eb7551fc3300015c81fde2b104e55175d6717587c1741731041ae1fc81e",
    "1fc47f105341175a5d17575d17535d1053411fd57f000b0004ffbe1b3dcc05727e19b4091662f0001b9f1fd022105500174fb51746201759f31044a91fca57",
    "1fc87f10474117565d17575d17495d1046411fd57f000100036b0c079c9906d56c19bb150b5bf00018081fd80b104fd5175467175c7c174f3310412e1fc89e",
  ];
  const QR_SIZE = 21;
  const qrDark = (n, x, y) => (parseInt(QR[n - 1].substr(y * 6, 6), 16) >> (QR_SIZE - 1 - x)) & 1;

  // The six treasures. `draw` paints one in a 100×100 box centred on (0, 0);
  // callers scale the canvas, so pencil lines grow with the treasure.
  const TREASURES = [
    { name: "the shiny star", color: "#ffc93c", draw: (c, r) => P.star(c, 0, 0, 40, r) },
    { name: "the golden key", color: "#f5d33b", draw: (c, r) => P.key(c, 0, 0, 125, r) },
    { name: "the butterfly wings", color: "#c8a6ff", draw: (c, r, t) => P.wingsShape(c, 0, 0, 120, r, "rgba(200,140,255,0.85)", Math.sin(t * 8) * 0.5) },
    { name: "the yummy candy", color: "#ff5c7a", draw: (c, r) => P.candy(c, 0, 0, 150, r, 0) },
    { name: "the big heart", color: "#ff5c7a", draw: (c, r, t) => P.heart(c, 0, 0, 80 * (1 + Math.sin(t * 6) * 0.06), r, "#ff5c7a") },
    { name: "the surprise gift", color: "#e5484d", draw: (c, r, t, open) => P.gift(c, 0, 5, 120, r, open) },
  ];
  const MAX = TREASURES.length;

  function drawTreasure(c, n, cx, cy, size, t, opts) {
    c.save();
    c.translate(cx, cy);
    c.scale(size / 100, size / 100);
    TREASURES[n - 1].draw(c, P.rng(P.hash(Math.floor(t * 6), n, 21)), t, opts && opts.open);
    c.restore();
  }

  // ------------------------------------------------------------ settings
  function loadSettings() {
    try { const d = JSON.parse(localStorage.getItem(STORE)); if (d && d.count) return d; } catch (_) { /* first time */ }
    return { count: 4 };
  }
  let settings = loadSettings();
  function saveSettings() { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (_) { /* private mode */ } }
  const hasClue = (n) => { try { return !!localStorage.getItem("mazoole.voice." + CLUE(n)); } catch (_) { return false; } };

  function icon(n, size, faded) {
    const c = document.createElement("canvas");
    c.width = c.height = size * 2;
    c.style.width = c.style.height = size + "px";
    const x = c.getContext("2d");
    x.scale(2, 2);
    if (faded) x.globalAlpha = 0.25;
    drawTreasure(x, n, size / 2, size / 2, size * 0.9, 0);
    return c;
  }

  // ------------------------------------------------------------ setup screen
  function openSetup() {
    stop();
    document.body.classList.add("in-menu");
    buildSetup();
    window.Mazoole.UI.show("hunt");
  }

  function buildSetup() {
    const pick = $("hunt-count");
    pick.innerHTML = "";
    for (let n = 3; n <= MAX; n++) {
      const b = document.createElement("button");
      b.textContent = n;
      b.className = n === settings.count ? "on" : "";
      b.onclick = () => { settings.count = n; saveSettings(); buildSetup(); };
      pick.appendChild(b);
    }
    const list = $("hunt-list");
    list.innerHTML = "";
    for (let n = 1; n <= MAX; n++) {
      const used = n <= settings.count, has = hasClue(n);
      const row = document.createElement("div");
      row.className = "voice-row hunt-row" + (used ? "" : " unused");
      row.appendChild(icon(n, 44));
      const label = document.createElement("div");
      label.className = "voice-label";
      label.innerHTML = `<b>Card ${n}: ${TREASURES[n - 1].name}</b><span>${!used ? "Not in this hunt" : has ? "Clue recorded ✓" : "No clue yet (optional)"}</span>`;
      row.appendChild(label);
      const rec = document.createElement("button");
      rec.textContent = has ? "● Record again" : "● Record clue";
      rec.onclick = () => window.MazooleVoices.record(CLUE(n), rec, buildSetup);
      row.appendChild(rec);
      if (has) {
        const pl = document.createElement("button");
        pl.textContent = "▶";
        pl.title = "Listen";
        pl.onclick = () => window.MazooleVoices.play(CLUE(n));
        const rm = document.createElement("button");
        rm.textContent = "✕";
        rm.title = "Delete this clue";
        rm.onclick = () => { window.MazooleVoices.set(CLUE(n), null); buildSetup(); };
        row.append(pl, rm);
      }
      list.appendChild(row);
    }
  }

  // ------------------------------------------------------------ printable cards
  // All six cards are drawn onto ONE sheet picture (2 across, 3 down) and printed
  // 180 mm wide, so it is 229 mm tall: that fits A4 or Letter whatever margins,
  // headers and footers the browser adds (iPhone Safari adds quite a lot).
  const CARD_W = 900, CARD_H = 765;
  const CARD_BG = ["#fff1b8", "#ffe0ec", "#e6dcff", "#d9f2ff", "#ffe2d6", "#dff5e1"];

  function drawCard(n, x, ox, oy) {
    const W = CARD_W, H = CARD_H;
    if (!x) {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      drawCard(n, c.getContext("2d"), 0, 0);
      return c;
    }
    const r = P.rng(P.hash(n, 5, 77));
    const color = P.PORTAL_COLORS[(n - 1) % P.PORTAL_COLORS.length];
    x.save();
    x.translate(ox, oy);
    x.beginPath(); x.rect(0, 0, W, H); x.clip();
    // crayon background with sprinkled stars and dots
    x.fillStyle = CARD_BG[(n - 1) % CARD_BG.length];
    x.fillRect(0, 0, W, H);
    x.globalAlpha = 0.18;
    x.strokeStyle = color; x.lineWidth = 9;
    x.beginPath();
    for (let i = -H; i < W; i += 38) { x.moveTo(i + (r() - 0.5) * 8, 0); x.lineTo(i + H * 0.55 + (r() - 0.5) * 8, H); }
    x.stroke();
    x.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {
      const sx = r() * W, sy = r() * H;
      if (sx > 150 && sx < W - 150 && sy < 600) continue; // keep the code area clean
      if (i % 2) P.star(x, sx, sy, 10 + r() * 10, r, ["#ffc93c", "#ff8fc1", "#3e7bfa", "#2fae62"][i % 4]);
      else { x.fillStyle = color; x.globalAlpha = 0.5; x.beginPath(); x.arc(sx, sy, 5 + r() * 6, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; }
    }
    // the code in a white box (cameras need the white margin) inside a gold picture frame
    const mod = 19, quiet = 3 * mod, box = QR_SIZE * mod + 2 * quiet;
    const bx = (W - box) / 2, by = 36;
    x.fillStyle = "#fff";
    x.fillRect(bx - 4, by - 4, box + 8, box + 8);
    for (const [pad, width, col, alpha] of [[16, 22, "#d9a82e", 0.95], [4, 5, P.INK, 0.85], [29, 4, P.INK, 0.85]]) {
      const pts = [[bx - pad, by - pad], [bx + box + pad, by - pad], [bx + box + pad, by + box + pad], [bx - pad, by + box + pad], [bx - pad, by - pad]];
      P.stroke(x, pts, r, 5, width, col, alpha);
    }
    x.fillStyle = "#000";
    for (let qy = 0; qy < QR_SIZE; qy++) {
      for (let qx = 0; qx < QR_SIZE; qx++) if (qrDark(n, qx, qy)) x.fillRect(bx + quiet + qx * mod, by + quiet + qy * mod, mod + 0.5, mod + 0.5);
    }
    for (const [sx, sy] of [[bx - 29, by - 29], [bx + box + 29, by - 29], [bx - 29, by + box + 29], [bx + box + 29, by + box + 29]]) P.star(x, sx, sy, 22, r, color);
    // the hero and the fairy guard the card, one on each side
    const side = (W - box) / 4;
    P.hero(x, side + 4, by + box * 0.5 + (n % 2) * 60, 200, n, { facing: 1 });
    P.fairy(x, W - side - 4, by + box * 0.5 + ((n + 1) % 2) * 60, 190, n, { facing: -1 });
    // the treasure, big, in the bottom corner
    x.save(); x.translate(W - 120, by + box + 98); x.scale(1.7, 1.7); TREASURES[n - 1].draw(x, r, 0); x.restore();
    // bottom: the number in a yellow crayon circle and the treasure's name
    const ly = by + box + 100;
    P.ellipse(x, 175, ly, 62, 58, r, 5, P.INK, "#ffd84d");
    x.fillStyle = P.INK;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "bold 104px 'Patrick Hand', 'Comic Sans MS', cursive";
    x.fillText(String(n), 175, ly + 6);
    x.textAlign = "left";
    x.font = "bold 58px 'Patrick Hand', 'Comic Sans MS', cursive";
    x.fillText("Treasure " + n, 268, ly - 26);
    x.font = "44px 'Patrick Hand', 'Comic Sans MS', cursive";
    x.globalAlpha = 0.8;
    x.fillText(TREASURES[n - 1].name, 270, ly + 32);
    x.restore();
  }

  function drawSheet() {
    const c = document.createElement("canvas");
    c.width = CARD_W * 2; c.height = CARD_H * 3;
    const x = c.getContext("2d");
    for (let n = 1; n <= MAX; n++) drawCard(n, x, ((n - 1) % 2) * CARD_W, Math.floor((n - 1) / 2) * CARD_H);
    // dashed cut lines
    x.save();
    x.strokeStyle = "#555"; x.lineWidth = 3; x.setLineDash([18, 12]);
    x.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
    x.beginPath();
    x.moveTo(CARD_W, 0); x.lineTo(CARD_W, c.height);
    for (let row = 1; row < 3; row++) { x.moveTo(0, row * CARD_H); x.lineTo(c.width, row * CARD_H); }
    x.stroke();
    x.restore();
    return c;
  }

  function printCards() {
    const sheet = $("hunt-print");
    sheet.innerHTML = "";
    const img = new Image();
    img.alt = "Six treasure cards to cut out";
    img.onload = () => setTimeout(() => window.print(), 100);
    img.src = drawSheet().toDataURL("image/png");
    sheet.appendChild(img);
  }

  // ------------------------------------------------------------ QR reading
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // Returns async (video) => [{ text, pts: [{x, y} × 4] }] in video pixels.
  async function makeReader() {
    if ("BarcodeDetector" in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.includes("qr_code")) {
          const det = new window.BarcodeDetector({ formats: ["qr_code"] });
          return async (video) => (await det.detect(video)).map((b) => ({ text: b.rawValue, pts: b.cornerPoints }));
        }
      } catch (_) { /* fall back to jsQR */ }
    }
    if (!window.jsQR) await loadScript("js/vendor/jsQR.js");
    const c = document.createElement("canvas");
    const x = c.getContext("2d", { willReadFrequently: true });
    return async (video) => {
      const k = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      c.width = Math.round(video.videoWidth * k);
      c.height = Math.round(video.videoHeight * k);
      x.drawImage(video, 0, 0, c.width, c.height);
      const img = x.getImageData(0, 0, c.width, c.height);
      const q = window.jsQR(img.data, c.width, c.height, { inversionAttempts: "dontInvert" });
      if (!q) return [];
      const L = q.location;
      return [{ text: q.data, pts: [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner].map((p) => ({ x: p.x / k, y: p.y / k })) }];
    };
  }

  // ------------------------------------------------------------ the hunt
  const H = {
    on: false, stream: null, read: null, wake: null,
    found: new Set(), seen: {}, party: null, sparks: [], t: 0, last: 0, done: false,
  };
  const SHOW = 2.6;   // seconds a new treasure dances on its card
  const FLY = 0.6;    // seconds it takes to fly into the bag

  function nextWanted() {
    for (let n = 1; n <= settings.count; n++) if (!H.found.has(n)) return n;
    return 0;
  }

  function say(html) {
    const box = $("hunt-say");
    box.innerHTML = html;
    box.hidden = !html;
  }

  async function start() {
    const UI = window.Mazoole.UI;
    H.found = new Set(); H.seen = {}; H.party = null; H.sparks = []; H.done = false; H.t = 0;
    window.Mazoole.G.mode = "hunt";
    UI.show("hunt-play");
    buildBag();
    showClue();
    say("Opening the camera…");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return problem("The camera only works when the game is opened from its <b>https://</b> web address (the GitHub Pages link), not from a file.");
    }
    try {
      H.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (e) {
      if (e && e.name === "NotAllowedError") return problem("The camera isn't allowed. Tap the icon next to the web address, allow the <b>Camera</b>, and try again.");
      if (e && (e.name === "NotFoundError" || e.name === "OverconstrainedError")) return problem("This device has no camera we can use.");
      return problem("The camera didn't start. Close other apps that use the camera and try again.");
    }
    if (window.Mazoole.G.mode !== "hunt") { stop(); return; } // they left while the camera was asking
    const video = $("hunt-video");
    video.srcObject = H.stream;
    try { await video.play(); } catch (_) { /* autoplay with muted+playsinline normally works */ }
    try { H.read = await makeReader(); } catch (_) {
      return problem("This browser can't read the treasure cards. Try Chrome.");
    }
    try { H.wake = navigator.wakeLock && await navigator.wakeLock.request("screen"); } catch (_) { /* fine without */ }
    say("");
    H.on = true;
    H.last = performance.now();
    requestAnimationFrame(frame);
    scanLoop();
    playClue();
  }

  function problem(html) {
    stopCamera();
    say(`${html}<br><button class="big" id="hunt-back">Back</button>`);
    $("hunt-back").onclick = openSetup;
  }

  function stopCamera() {
    H.on = false;
    if (H.stream) H.stream.getTracks().forEach((t) => t.stop());
    H.stream = null;
    const video = $("hunt-video");
    if (video) video.srcObject = null;
    if (H.wake) { H.wake.release().catch(() => {}); H.wake = null; }
  }
  function stop() { stopCamera(); }

  async function scanLoop() {
    const video = $("hunt-video");
    while (H.on) {
      if (video.readyState >= 2 && video.videoWidth) {
        let codes = [];
        try { codes = await H.read(video); } catch (_) { /* skip this frame */ }
        const now = performance.now();
        for (const code of codes) {
          const m = /MAZOOLE:(\d+)/i.exec(code.text || "");
          const n = m ? +m[1] : 0;
          if (n < 1 || n > MAX || !code.pts || code.pts.length < 4) continue;
          spotted(n, code.pts, now);
        }
      }
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  // Video pixels → screen pixels (the video fills the screen like object-fit: cover)
  function toScreen(pt) {
    const video = $("hunt-video"), W = innerWidth, Hh = innerHeight;
    const k = Math.max(W / video.videoWidth, Hh / video.videoHeight);
    return { x: (W - video.videoWidth * k) / 2 + pt.x * k, y: (Hh - video.videoHeight * k) / 2 + pt.y * k };
  }

  function spotted(n, pts, now) {
    const s = pts.map(toScreen);
    const cx = s.reduce((a, p) => a + p.x, 0) / 4, cy = s.reduce((a, p) => a + p.y, 0) / 4;
    let side = 0;
    for (let i = 0; i < 4; i++) side += Math.hypot(s[(i + 1) % 4].x - s[i].x, s[(i + 1) % 4].y - s[i].y) / 4;
    const old = H.seen[n];
    const fresh = !old || now - old.at > 1500; // card just came into view
    // smooth the jumps between readings so things don't jitter
    if (old && now - old.at < 500) {
      old.x += (cx - old.x) * 0.6; old.y += (cy - old.y) * 0.6; old.size += (side - old.size) * 0.6; old.at = now;
    } else {
      H.seen[n] = { x: cx, y: cy, size: side, at: now };
    }
    if (n > settings.count) { if (fresh) window.Mazoole.UI.toast(`Card ${n} isn't in this hunt. Keep looking!`); }
    else if (!H.found.has(n)) { if (!H.party) found(n); }
    else if (fresh && !(H.party && H.party.n === n)) window.Mazoole.UI.toast("You already found this one! ✓");
  }

  function found(n) {
    H.found.add(n);
    H.party = { n, t: 0 };
    const p = H.seen[n];
    burst(p.x, p.y, p.size, TREASURES[n - 1].color, 40);
    sfx("star");
    if (navigator.vibrate) try { navigator.vibrate([60, 40, 120]); } catch (_) { /* no buzz */ }
    say(`<b>You found ${TREASURES[n - 1].name}!</b>`);
    $("hunt-clue").hidden = true;
  }

  function sfx(name) {
    const M = window.Mazoole;
    if (M && M.sfx) M.sfx(name);
  }

  function burst(x, y, size, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.6 + Math.random()) * Math.max(160, size * 2.2);
      H.sparks.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - size, life: 1 + Math.random() * 0.6,
        color: Math.random() < 0.5 ? color : ["#ffc93c", "#3e7bfa", "#2fae62", "#ff8fc1"][i % 4], star: i % 3 === 0, size: 6 + Math.random() * 8,
      });
    }
  }

  function bagSlot(n) {
    const el = $("hunt-bag").children[n - 1];
    if (!el) return { x: innerWidth / 2, y: 30 };
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }

  function buildBag() {
    const bag = $("hunt-bag");
    bag.innerHTML = "";
    for (let n = 1; n <= settings.count; n++) {
      const slot = document.createElement("span");
      slot.className = "slot" + (H.found.has(n) ? " got" : "");
      slot.appendChild(icon(n, 40, !H.found.has(n)));
      bag.appendChild(slot);
    }
  }

  function showClue() {
    const n = nextWanted(), box = $("hunt-clue");
    if (!n) { box.hidden = true; return; }
    box.hidden = false;
    $("hunt-clue-pic").innerHTML = "";
    $("hunt-clue-pic").appendChild(icon(n, 64));
    $("hunt-clue-text").innerHTML = `<b>Find card ${n}</b><span>${TREASURES[n - 1].name}</span>`;
    $("hunt-hear").hidden = !hasClue(n);
  }

  function playClue() {
    const n = nextWanted();
    if (n && hasClue(n)) window.MazooleVoices.play(CLUE(n));
  }

  function partyOver() {
    const n = H.party.n;
    H.party = null;
    buildBag();
    const slot = $("hunt-bag").children[n - 1];
    if (slot) { slot.classList.remove("pop"); void slot.offsetWidth; slot.classList.add("pop"); }
    say("");
    if (!nextWanted()) return finish();
    // another card already in view? It counts right away.
    const now = performance.now();
    for (let m = 1; m <= settings.count; m++) {
      if (!H.found.has(m) && H.seen[m] && now - H.seen[m].at < 700) return found(m);
    }
    showClue();
    playClue();
  }

  function finish() {
    H.done = true;
    stopCamera();
    sfx("win");
    const PR = window.MazooleProgress, UI = window.Mazoole.UI;
    if (PR) {
      UI.stickers(PR.bump("hunts"));
      UI.stickers(PR.best("biggestHunt", settings.count));
    }
    $("hunt-done-text").textContent = `You found all ${settings.count} treasures!`;
    const row = $("hunt-done-row");
    row.innerHTML = "";
    for (let n = 1; n <= settings.count; n++) row.appendChild(icon(n, 46));
    UI.show("hunt-done");
    finale();
  }

  // The last screen: the gift opens and the hero and fairy dance
  function finale() {
    const c = $("hunt-done-canvas"), x = c.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = 260, Hh = 170;
    c.width = W * dpr; c.height = Hh * dpr;
    c.style.width = W + "px"; c.style.height = Hh + "px";
    const t0 = performance.now();
    const tick = (now) => {
      if ($("hunt-done").hidden) return;
      const t = (now - t0) / 1000;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, W, Hh);
      P.hero(x, 50, 110 - Math.abs(Math.sin(t * 4)) * 14, 90, t, { moving: true, facing: 1 });
      P.fairy(x, 210, 100, 90, t, { flying: true, facing: -1 });
      P.gift(x, 130, 105, 110, P.rng(P.hash(Math.floor(t * 6), 3, 9)), t > 0.6);
      if (t > 0.6) P.star(x, 130, 70 - Math.min(1, (t - 0.6) * 2) * 30 + Math.sin(t * 3) * 4, 18, P.rng(P.hash(Math.floor(t * 6), 4, 9)));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------ drawing on top of the camera
  function frame(now) {
    if (!H.on) return;
    if ($("hunt-play").hidden) { stop(); return; } // left with Esc or the menu
    const dt = Math.min(0.05, (now - H.last) / 1000);
    H.last = now;
    H.t += dt;
    const cv = $("hunt-canvas"), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = innerWidth, Hh = innerHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Hh * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, Hh);
    const t = H.t;

    // aiming frame in the middle while nothing is in view
    const anyInView = Object.values(H.seen).some((s) => now - s.at < 600);
    if (!anyInView && !H.party) {
      const k = Math.min(W, Hh) * 0.55, bob = Math.sin(t * 3) * 6;
      const r = P.rng(P.hash(Math.floor(t * 3), 1, 31));
      c.save();
      c.setLineDash([14, 12]);
      P.stroke(c, [[W / 2 - k / 2, Hh / 2 - k / 2], [W / 2 + k / 2, Hh / 2 - k / 2], [W / 2 + k / 2, Hh / 2 + k / 2], [W / 2 - k / 2, Hh / 2 + k / 2], [W / 2 - k / 2, Hh / 2 - k / 2]], r, 3, 4, "#fff", 0.8);
      c.restore();
      P.fairy(c, W / 2 + k / 2 - 10, Hh / 2 - k / 2 - 30 + bob, 90, t, { flying: true, facing: -1 });
    }

    // cards in view
    for (const key of Object.keys(H.seen)) {
      const n = +key, s = H.seen[n], age = now - s.at;
      if (age > 900 && !(H.party && H.party.n === n)) continue;
      const fade = Math.max(0, Math.min(1, 1 - (age - 400) / 500));
      if (H.party && H.party.n === n) continue; // drawn below
      if (H.found.has(n)) {
        c.save(); c.globalAlpha = 0.85 * fade;
        drawTreasure(c, n, s.x, s.y - s.size * 0.75, s.size * 0.6, t);
        bubble(c, s.x + s.size * 0.4, s.y - s.size * 1.0, s.size * 0.18, "✓", "#2fae62");
        c.restore();
      } else if (n > settings.count) {
        c.save(); c.globalAlpha = 0.7 * fade;
        bubble(c, s.x, s.y, s.size * 0.25, "?", "#9b5de5");
        c.restore();
      }
    }

    // the treasure that was just found: pop, dance, then fly into the bag
    if (H.party) {
      const n = H.party.n;
      H.party.t += dt;
      const e = H.party.t;
      const s = H.seen[n];
      const live = now - s.at < 700;
      // stay on the card while it's in view; otherwise drift to the middle of the screen
      const target = live ? { x: s.x, y: s.y - s.size * 0.9, size: Math.max(120, s.size * 1.1) } : { x: W / 2, y: Hh * 0.45, size: Math.min(W, Hh) * 0.4 };
      const a = H.party.at || (H.party.at = { ...target });
      a.x += (target.x - a.x) * Math.min(1, dt * 8);
      a.y += (target.y - a.y) * Math.min(1, dt * 8);
      a.size += (target.size - a.size) * Math.min(1, dt * 8);
      let x = a.x, y = a.y, size = a.size;
      if (e < 0.6) {
        // springy pop out of the card
        const k = e / 0.6;
        size *= 1 + Math.sin(k * Math.PI) * 0.35 - (1 - k) * 0.9;
        y = s.y + (y - s.y) * k;
      } else if (e < SHOW) {
        y += Math.sin(e * 5) * size * 0.06;
        if (Math.random() < dt * 8) burst(x + (Math.random() - 0.5) * size, y + (Math.random() - 0.5) * size, size * 0.2, TREASURES[n - 1].color, 1);
      } else {
        const k = Math.min(1, (e - SHOW) / FLY), slot = bagSlot(n), ease = k * k * (3 - 2 * k);
        x += (slot.x - x) * ease;
        y += (slot.y - y) * ease - Math.sin(k * Math.PI) * 120;
        size += (40 - size) * ease;
      }
      // glow
      c.save();
      const g = c.createRadialGradient(x, y, 0, x, y, size * 0.9);
      g.addColorStop(0, "rgba(255,247,190,0.85)");
      g.addColorStop(1, "rgba(255,247,190,0)");
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, size * 0.9, 0, Math.PI * 2); c.fill();
      c.restore();
      drawTreasure(c, n, x, y, size, t, { open: e > 0.8 });
      if (e < SHOW) {
        // the fairy circles the treasure and the hero cheers underneath
        const ang = e * 3.2;
        P.fairy(c, x + Math.cos(ang) * size * 0.85, y + Math.sin(ang) * size * 0.45, size * 0.75, t, { flying: true, facing: Math.sin(ang) > 0 ? -1 : 1 });
        P.hero(c, x - size * 0.75, y + size * 0.55 - Math.abs(Math.sin(e * 7)) * size * 0.15, size * 0.65, t, { moving: true, facing: 1 });
      }
      if (e >= SHOW + FLY) partyOver();
    }

    // sparkles
    for (const p of H.sparks) {
      p.life -= dt;
      p.vy += 500 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      c.save();
      c.globalAlpha = Math.max(0, Math.min(1, p.life));
      if (p.star) P.star(c, p.x, p.y, p.size, P.rng(P.hash(p.x | 0, p.y | 0, 3)), p.color);
      else { c.fillStyle = p.color; c.fillRect(p.x - p.size / 3, p.y - p.size / 3, p.size / 1.5, p.size / 1.5); }
      c.restore();
    }
    H.sparks = H.sparks.filter((p) => p.life > 0);

    requestAnimationFrame(frame);
  }

  function bubble(c, x, y, rad, text, color) {
    c.save();
    c.fillStyle = "#fff";
    c.strokeStyle = color;
    c.lineWidth = Math.max(3, rad * 0.18);
    c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = color;
    c.font = `bold ${Math.round(rad * 1.3)}px 'Patrick Hand', cursive`;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(text, x, y + rad * 0.05);
    c.restore();
  }

  window.addEventListener("DOMContentLoaded", () => {
    $("btn-hunt").onclick = openSetup;
    $("hunt-print-btn").onclick = printCards;
    $("hunt-start").onclick = start;
    $("hunt-again").onclick = start;
    $("hunt-exit").onclick = () => { stop(); window.Mazoole.UI.menu(); };
    $("hunt-hear").onclick = playClue;
    $("hunt-setup").onclick = openSetup;
  });

  window.MazooleHunt = { open: openSetup, start, stop, drawCard, drawSheet, TREASURES, QR, qrDark, _state: H };
})();
