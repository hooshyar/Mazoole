// Photo -> maze. Take a picture of a drawing and get a draft maze to fix up.
//
// 1. Find the white paper in the photo (skip the desk around it).
// 2. Mark pencil lines: pixels clearly darker than the paper around them.
// 3. Lay a grid over the paper. A square becomes a wall if enough pencil is in it.
// 4. Put the hero at the top-left of the biggest open area and the goal as far away as possible.
(function () {
  const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("That file doesn't look like a photo."));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function canvasOf(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  // Returns { canvas, url, aspect }: the paper only, at most 640px on its long side.
  async function load(file) {
    const img = await loadImage(file);
    const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const a = canvasOf(w, h), ac = a.getContext("2d");
    ac.drawImage(img, 0, 0, w, h);
    const d = ac.getImageData(0, 0, w, h).data;

    // paper = grey-to-white with no colour cast; a wooden desk is clearly orange
    // (paper in shadow can be quite dark, so don't rely on brightness alone)
    const isPaper = (i) => d[i] - d[i + 2] < 35 && lum(d, i) > 90;
    const rowFrac = new Float32Array(h), colFrac = new Float32Array(w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (isPaper((y * w + x) * 4)) { rowFrac[y]++; colFrac[x]++; }
    }
    const span = (arr, n, len) => {
      let lo = 0, hi = len - 1;
      while (lo < hi && arr[lo] / n < 0.55) lo++;
      while (hi > lo && arr[hi] / n < 0.55) hi--;
      return hi - lo > len * 0.3 ? [lo, hi] : [0, len - 1]; // no clear paper: keep everything
    };
    let [y0, y1] = span(rowFrac, w, h), [x0, x1] = span(colFrac, h, w);
    // step in a little to skip the paper's edge and the spiral holes
    const px = Math.round((x1 - x0) * 0.03), py = Math.round((y1 - y0) * 0.03);
    x0 += px; x1 -= px; y0 += py; y1 -= py;

    const cw = x1 - x0, ch = y1 - y0;
    const k2 = Math.min(1, 640 / Math.max(cw, ch));
    const out = canvasOf(Math.round(cw * k2), Math.round(ch * k2));
    out.getContext("2d").drawImage(a, x0, y0, cw, ch, 0, 0, out.width, out.height);
    return { canvas: out, url: out.toDataURL("image/jpeg", 0.72), aspect: out.height / out.width };
  }

  // sensitivity 1 (only bold lines) .. 10 (every faint mark)
  function toGrid(photo, cols, rows, sensitivity) {
    const c = photo.canvas, w = c.width, h = c.height;
    const d = c.getContext("2d").getImageData(0, 0, w, h).data;

    // local average brightness (integral image), so shadows on the paper don't count as lines
    const I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += lum(d, (y * w + x) * 4);
        I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
      }
    }
    const R = Math.max(6, Math.round(Math.max(w, h) / 40));
    const dark = new Uint8Array(w * h);
    const drop = 0.26 - sensitivity * 0.018; // how much darker than the neighbourhood a line must be
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - R), xb = Math.min(w, x + R + 1), ya = Math.max(0, y - R), yb = Math.min(h, y + R + 1);
      const sum = I[yb * (w + 1) + xb] - I[ya * (w + 1) + xb] - I[yb * (w + 1) + xa] + I[ya * (w + 1) + xa];
      const mean = sum / ((xb - xa) * (yb - ya));
      if (lum(d, (y * w + x) * 4) < mean * (1 - drop)) dark[y * w + x] = 1;
    }

    const need = 0.11 - sensitivity * 0.009; // share of a square that must be pencil
    const grid = [];
    for (let gy = 0; gy < rows; gy++) {
      const row = [];
      for (let gx = 0; gx < cols; gx++) {
        if (gx === 0 || gy === 0 || gx === cols - 1 || gy === rows - 1) { row.push("#"); continue; }
        const xa = Math.floor((gx * w) / cols), xb = Math.floor(((gx + 1) * w) / cols);
        const ya = Math.floor((gy * h) / rows), yb = Math.floor(((gy + 1) * h) / rows);
        let n = 0;
        for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) n += dark[y * w + x];
        row.push(n / Math.max(1, (xb - xa) * (yb - ya)) > need ? "#" : ".");
      }
      grid.push(row);
    }
    placeStartAndGoal(grid);
    return grid;
  }

  function placeStartAndGoal(grid) {
    const h = grid.length, w = grid[0].length;
    const seen = new Int32Array(w * h).fill(-1);
    let best = null;
    // find the biggest open area
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (grid[y][x] !== "." || seen[y * w + x] >= 0) continue;
      const cells = [[x, y]];
      seen[y * w + x] = 1;
      for (let i = 0; i < cells.length; i++) {
        const [cx, cy] = cells[i];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (grid[ny][nx] === "." && seen[ny * w + nx] < 0) { seen[ny * w + nx] = 1; cells.push([nx, ny]); }
        }
      }
      if (!best || cells.length > best.length) best = cells;
    }
    if (!best || best.length < 3) { grid[1][1] = "1"; grid[1][2] = "2"; grid[h - 2][w - 2] = "G"; return; }
    const start = best.reduce((a, b) => (a[0] + a[1] <= b[0] + b[1] ? a : b));
    // goal: the farthest square you can walk to from the start
    const dist = new Map([[start + "", 0]]), q = [start];
    let far = start;
    for (let i = 0; i < q.length; i++) {
      const [cx, cy] = q[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = [cx + dx, cy + dy];
        if (grid[k[1]][k[0]] === "." && !dist.has(k + "")) { dist.set(k + "", dist.get(q[i] + "") + 1); q.push(k); far = k; }
      }
    }
    grid[start[1]][start[0]] = "1";
    const buddy = q.find((c) => Math.abs(c[0] - start[0]) + Math.abs(c[1] - start[1]) === 1);
    if (buddy && buddy !== far) grid[buddy[1]][buddy[0]] = "2";
    grid[far[1]][far[0]] = "G";
  }

  window.MazoolePhoto = { load, toGrid };
})();
