#!/usr/bin/env node
// Checks every maze in js/levels.js (or the file you pass): can player 1 reach the goal on foot (wings allowed as a
// Usage: node tools/check-levels.js
// fallback), and can every star be collected? Mirrors the rules in js/game.js:
// walls, buttons/doors, keys/locks, ice slides, portals, wings (6 s ≈ 30 squares).
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(process.argv[2] || require('path').join(__dirname, '..', 'js', 'levels.js'), 'utf8'));
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const FLY = 30;

function solve(def) {
  const g = def.map.map((r) => r.split('')), h = g.length, w = g[0].length;
  const issues = [];
  if (g.some((r) => r.length !== w)) issues.push('rows have different lengths');
  for (let x = 0; x < w; x++) if (g[0][x] !== '#' || g[h - 1][x] !== '#') issues.push('top/bottom edge not wall');
  for (let y = 0; y < h; y++) if (g[y][0] !== '#' || g[y][w - 1] !== '#') issues.push('side edge not wall');
  const find = (ch) => { const out = []; g.forEach((r, y) => r.forEach((c, x) => c === ch && out.push([x, y]))); return out; };
  const keys = find('k'), locks = find('L'), stars = find('*'), wings = find('w');
  const portals = {}; for (const d of '3456789') { const p = find(d); if (p.length) portals[d] = p; if (p.length && p.length !== 2) issues.push('portal ' + d + ' needs 2'); }
  const start = find('1')[0];
  const border = (x, y) => x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1;
  // state: x,y,slide,keysHeld,taken,opened,pressed
  const enc = (s) => [s.x, s.y, s.sl, s.k, s.tk, s.op, s.pr].join(',');
  const s0 = { x: start[0], y: start[1], sl: -1, k: 0, tk: 0, op: 0, pr: '' };
  const seen = new Set([enc(s0)]), q = [s0], visited = new Set();
  let goal = false, maxKeys = 0;
  const canEnter = (s, x, y) => {
    if (border(x, y)) return false;
    const c = g[y][x];
    if (c === '#' || c === 'F' || c === 'X') return false; // purple gates: treat as shut (co-op only)
    if (c === 'L') { const i = locks.findIndex((l) => l[0] === x && l[1] === y); return (s.op >> i) & 1 || s.k > 0; }
    if (c >= 'A' && c <= 'C') return s.pr.includes(c.toLowerCase());
    return true;
  };
  const enter = (s, x, y, d) => {
    const n = { ...s, x, y, sl: -1 };
    const c = g[y][x];
    if (c === 'L') { const i = locks.findIndex((l) => l[0] === x && l[1] === y); if (!((n.op >> i) & 1)) { n.k--; n.op |= 1 << i; } }
    if (c === 'k') { const i = keys.findIndex((l) => l[0] === x && l[1] === y); if (!((n.tk >> i) & 1)) { n.tk |= 1 << i; n.k++; } }
    if (c >= 'a' && c <= 'c' && !n.pr.includes(c)) n.pr = [...n.pr + c].sort().join('');
    if (c === '~') n.sl = d;
    if (portals[c]) { const o = portals[c].find((p) => p[0] !== x || p[1] !== y); if (o) { n.x = o[0]; n.y = o[1]; n.sl = -1; } }
    return n;
  };
  while (q.length) {
    const s = q.shift();
    visited.add(s.x + ',' + s.y);
    if (g[s.y][s.x] === 'G') goal = true;
    const opts = [];
    if (s.sl >= 0 && g[s.y][s.x] === '~') {
      const [dx, dy] = DIRS[s.sl], nx = s.x + dx, ny = s.y + dy;
      if (g[ny][nx] !== 'L' && canEnter(s, nx, ny)) opts.push([nx, ny, s.sl]);
    }
    if (!opts.length) DIRS.forEach(([dx, dy], d) => { if (canEnter(s, s.x + dx, s.y + dy)) opts.push([s.x + dx, s.y + dy, d]); });
    for (const [nx, ny, d] of opts) {
      const n = enter(s, nx, ny, d), k = enc(n);
      if (!seen.has(k)) { seen.add(k); q.push(n); }
    }
  }
  // wings: from a wings square you can fly ~30 squares over anything (not the border)
  const flyReach = new Set();
  for (const [wx, wy] of wings) {
    if (!visited.has(wx + ',' + wy)) continue;
    const dist = new Map([[wx + ',' + wy, 0]]), fq = [[wx, wy]];
    while (fq.length) {
      const [x, y] = fq.shift(), d0 = dist.get(x + ',' + y);
      flyReach.add(x + ',' + y);
      if (d0 >= FLY) continue;
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, kk = nx + ',' + ny; if (!border(nx, ny) && !dist.has(kk)) { dist.set(kk, d0 + 1); fq.push([nx, ny]); } }
    }
  }
  const goalPos = find('G')[0];
  const goalByWings = !goal && goalPos && flyReach.has(goalPos.join(','));
  const missingStars = stars.filter(([x, y]) => !visited.has(x + ',' + y) && !flyReach.has(x + ',' + y));
  const wingStars = stars.filter(([x, y]) => !visited.has(x + ',' + y) && flyReach.has(x + ',' + y)).length;
  return { goal, goalByWings, stars: stars.length, wingStars, missingStars, issues: [...new Set(issues)], states: seen.size };
}

let bad = 0;
for (const def of window.MAZOOLE_LEVELS) {
  if (def.coop) { console.log(`- ${def.name}: co-op puzzle (skipped)`); continue; }
  const r = solve(def);
  const ok = (r.goal || r.goalByWings) && !r.missingStars.length && !r.issues.length;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${def.name}: goal ${r.goal ? 'on foot' : r.goalByWings ? 'with wings' : 'UNREACHABLE'}, stars ${r.stars - r.missingStars.length}/${r.stars}${r.wingStars ? ` (${r.wingStars} need wings)` : ''}${r.issues.length ? ' ISSUES: ' + r.issues.join('; ') : ''}${r.missingStars.length ? ' missing ' + JSON.stringify(r.missingStars) : ''}`);
}
process.exit(bad ? 1 : 0);
