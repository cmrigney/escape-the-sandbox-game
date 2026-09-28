// Rough balance sim: grind wild battles, then challenge each gate.
import { MOVES, MONS, MOBY_LEARN, makeFoe, xpForLevel, typeEff } from "../src/data.js";
import { newMoby, recalcMoby } from "../src/state.js";
import { calcDamage, foeChoose } from "../src/battle.js";
import { MAPS } from "../src/story.js";

const stageMul = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
function fight(m, foe, bag) {
  const st = { moby: { atk: 0, def: 0, spd: 0 }, foe: { atk: 0, def: 0, spd: 0 } };
  for (let turn = 0; turn < 60; turn++) {
    // moby picks best expected damage move
    let best = null, bestV = -1;
    for (const s of m.moves) {
      const mv = MOVES[s.id];
      if (s.pp <= 0) continue;
      let v = mv.power * (mv.hits ? (mv.hits[0] + mv.hits[1]) / 2 : 1) * typeEff(mv.type, foe.type) * (mv.type === "CORE" ? 1.5 : 1) * mv.acc / 100;
      if (mv.heal && m.hp < m.maxhp * 0.35) v = 999;
      if (v > bestV) { bestV = v; best = s; }
    }
    let useItem = m.hp < m.maxhp * 0.3 && bag.n > 0 && !(best && MOVES[best.id].heal);
    const act = (isMoby) => {
      if (isMoby) {
        if (useItem) { bag.n--; m.hp = Math.min(m.maxhp, m.hp + bag.heal); return; }
        const s = best ?? { id: "tail", pp: 1 }; s.pp--;
        const mv = MOVES[s.id];
        if (Math.random() * 100 >= mv.acc) return;
        if (mv.heal) { m.hp = Math.min(m.maxhp, m.hp + Math.ceil(m.maxhp * mv.heal)); return; }
        const hits = mv.hits ? mv.hits[0] + Math.floor(Math.random() * (mv.hits[1] - mv.hits[0] + 1)) : 1;
        for (let i = 0; i < hits; i++) if (mv.power) foe.hp -= calcDamage({ ...m, type: "CORE" }, foe, st.moby, st.foe, mv).dmg;
        if (mv.effect && (mv.effect.chance === undefined || Math.random() < mv.effect.chance)) { const w = mv.effect.target === "self" ? st.moby : st.foe; w[mv.effect.stat] = Math.max(-6, Math.min(6, w[mv.effect.stat] + mv.effect.delta)); }
      } else {
        const s = foeChoose(foe); s.pp--;
        const mv = MOVES[s.id];
        if (Math.random() * 100 >= mv.acc) return;
        if (mv.heal) { foe.hp = Math.min(foe.maxhp, foe.hp + Math.ceil(foe.maxhp * mv.heal)); return; }
        const hits = mv.hits ? mv.hits[0] + Math.floor(Math.random() * (mv.hits[1] - mv.hits[0] + 1)) : 1;
        for (let i = 0; i < hits; i++) if (mv.power) m.hp -= calcDamage(foe, { ...m, type: "CORE" }, st.foe, st.moby, mv).dmg;
        if (mv.effect && (mv.effect.chance === undefined || Math.random() < mv.effect.chance)) { const w = mv.effect.target === "self" ? st.foe : st.moby; w[mv.effect.stat] = Math.max(-6, Math.min(6, w[mv.effect.stat] + mv.effect.delta)); }
      }
    };
    const mFirst = m.spd * stageMul(st.moby.spd) >= foe.spd * stageMul(st.foe.spd);
    for (const who of mFirst ? [true, false] : [false, true]) { act(who); if (m.hp <= 0 || foe.hp <= 0) break; }
    if (foe.hp <= 0) return true;
    if (m.hp <= 0) return false;
  }
  return false;
}
function gainXp(m, foe, mult) {
  m.xp += Math.floor((MONS[foe.id].xp * foe.level) / 6 * mult);
  while (m.xp >= xpForLevel(m.level + 1)) {
    m.level++; recalcMoby(m);
    for (const [lv, id] of MOBY_LEARN) if (lv === m.level) { if (m.moves.length < 4) m.moves.push({ id, pp: MOVES[id].pp }); else { m.moves.sort((a, b) => MOVES[a.id].power - MOVES[b.id].power); if (id !== "health") m.moves[0] = { id, pp: MOVES[id].pp }; else m.moves[0] = { id, pp: MOVES[id].pp }; } }
  }
}
const heal = (m) => { m.hp = m.maxhp; m.moves.forEach((s) => (s.pp = MOVES[s.id].pp)); };
function wild(map) {
  const t = MAPS[map].encounters.table; const tot = t.reduce((a, r) => a + r[3], 0); let r = Math.random() * tot;
  const row = t.find((x) => (r -= x[3]) < 0) ?? t[0];
  return makeFoe(row[0], row[1] + Math.floor(Math.random() * (row[2] - row[1] + 1)));
}
function trainerOf(map, id) { return MAPS[map].entities.find((e) => e.id === id).trainer.foes; }
const GRIND = +process.argv[2] || 8;
const plan = [
  ["tmp", GRIND, [["t", "tmp", "linter"], ["b", "proxy", 10]]],
  ["proc", GRIND, [["t", "proc", "sysadmin"], ["b", "seccomp", 15], ["t", "proc", "kiddie"]]],
  ["cgroup", GRIND, [["t", "cgroup", "pentester"], ["b", "oom", 18]]],
  [null, 0, [["b", "hyper", 21]]],
];
const N = 300; const results = {};
for (let run = 0; run < N; run++) {
  const m = newMoby(5); let losses = 0;
  for (const [map, grind, gates] of plan) {
    for (let i = 0; i < grind && map; i++) { const f = wild(map); if (fight(m, f, { n: 0, heal: 30 })) gainXp(m, f, 1); else losses++; heal(m); }
    for (const g of gates) {
      const key = g[0] === "t" ? g[2] : g[1];
      const foes = g[0] === "t" ? trainerOf(g[1], g[2]).map((f) => makeFoe(f.id, f.level)) : [makeFoe(g[1], g[2])];
      let tries = 0, won = false;
      while (!won && tries < 6) {
        tries++; heal(m); const bag = { n: 3, heal: 60 }; won = true;
        for (const f of foes) { if (fight(m, f, bag)) gainXp(m, f, 1.5); else { won = false; break; } }
        if (!won) for (let i = 0; i < 3 && map; i++) { const f = wild(map); if (fight(m, f, { n: 0, heal: 0 })) gainXp(m, f, 1); heal(m); }
      }
      results[key] ??= { tries: 0, lvl: 0, fail: 0 }; results[key].tries += tries; results[key].lvl += m.level; if (!won) results[key].fail++;
    }
  }
  results.wildLosses = (results.wildLosses ?? 0) + losses;
}
for (const [k, v] of Object.entries(results)) console.log(k.padEnd(10), typeof v === "number" ? (v / N).toFixed(2) : `avg tries ${(v.tries / N).toFixed(2)}  avg lvl ${(v.lvl / N).toFixed(1)}  gave up ${v.fail}`);
