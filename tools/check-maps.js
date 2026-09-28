// Sanity checks: map widths, reachability of warps/entities/interactables.
import { MAPS } from "../src/story.js";
const SOLID = new Set(["#", "R", "C", "~", "T", "H", "S", "="]);
let ok = true;
const fail = (m) => { ok = false; console.log("FAIL", m); };
for (const [id, m] of Object.entries(MAPS)) {
  const w = m.grid[0].length;
  m.grid.forEach((r, i) => r.length !== w && fail(`${id} row ${i} width ${r.length} != ${w}`));
  const entry = Object.values(MAPS).flatMap((o) => o.warps ?? []).find((wp) => wp.to === id) ?? { tx: 6, ty: 5 };
  // entities (non-boss) block; bosses considered beaten
  const blockers = new Set((m.entities ?? []).filter((e) => !e.id.match(/proxy|seccomp|oom|hyper/)).map((e) => `${e.x},${e.y}`));
  const seen = new Set([`${entry.tx},${entry.ty}`]);
  const q = [[entry.tx, entry.ty]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (ny < 0 || ny >= m.grid.length || nx < 0 || nx >= w || seen.has(k)) continue;
      if (SOLID.has(m.grid[ny][nx]) || blockers.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  const adj = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
  for (const wp of m.warps ?? []) if (!seen.has(`${wp.x},${wp.y}`)) fail(`${id} warp ${wp.x},${wp.y} unreachable`);
  for (const wp of m.warps ?? []) { const t = MAPS[wp.to].grid[wp.ty]?.[wp.tx]; if (!t || SOLID.has(t)) fail(`${id} warp target ${wp.to} ${wp.tx},${wp.ty} is '${t}'`); }
  for (const e of m.entities ?? []) {
    const t = m.grid[e.y][e.x];
    if (SOLID.has(t)) fail(`${id} entity ${e.id} on solid '${t}'`);
    if (!adj(e.x, e.y)) fail(`${id} entity ${e.id} not reachable`);
  }
  for (const k of Object.keys(m.texts ?? {})) { const [x, y] = k.split(",").map(Number); if (!adj(x, y)) fail(`${id} text at ${k} unreachable`); if (!SOLID.has(m.grid[y][x])) fail(`${id} text at ${k} is on '${m.grid[y][x]}'`); }
  for (const k of Object.keys(m.triggers ?? {})) if (!seen.has(k)) fail(`${id} trigger ${k} unreachable`);
  m.grid.forEach((r, y) => [...r].forEach((c, x) => { if ((c === "H" || c === "S" || c === "T") && !adj(x, y)) fail(`${id} ${c} at ${x},${y} unreachable`); if (c === "S" && !(m.texts ?? {})[`${x},${y}`]) fail(`${id} sign ${x},${y} has no text`); }));
  console.log(`${id}: ${w}x${m.grid.length}, reachable ${seen.size}`);
}
console.log(ok ? "ALL OK" : "PROBLEMS FOUND");
