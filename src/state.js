// Persistent game state + save/load.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MOBY_BASE, MOVES, calcStats, xpForLevel } from "./data.js";

export const SAVE_PATH = process.env.MOBY_SAVE ?? path.join(os.homedir(), ".moby-escape-save.json");

export function newMoby(level = 5) {
  const st = calcStats(MOBY_BASE, level);
  return {
    level, xp: xpForLevel(level), ...st, maxhp: st.hp,
    moves: [
      { id: "tail", pp: MOVES.tail.pp },
      { id: "cache", pp: MOVES.cache.pp },
    ],
  };
}

export function recalcMoby(m) {
  const st = calcStats(MOBY_BASE, m.level);
  const gained = st.hp - m.maxhp;
  m.maxhp = st.hp;
  m.hp = Math.min(m.maxhp, m.hp + Math.max(0, gained));
  m.atk = st.atk;
  m.def = st.def;
  m.spd = st.spd;
}

export function newState() {
  return {
    map: "workspace", x: 6, y: 5, facing: "up",
    respawn: { map: "workspace", x: 12, y: 2 },
    moby: newMoby(5),
    bag: { restart: 2 },
    flags: {},
    wins: 0,
    steps: 0,
  };
}

export function healMoby(state) {
  const m = state.moby;
  m.hp = m.maxhp;
  for (const mv of m.moves) mv.pp = MOVES[mv.id].pp;
}

export function saveGame(state) {
  try {
    fs.writeFileSync(SAVE_PATH, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    return JSON.parse(fs.readFileSync(SAVE_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function hasSave() {
  return fs.existsSync(SAVE_PATH);
}
