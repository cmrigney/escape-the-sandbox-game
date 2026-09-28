// Types, moves, monsters, items.
import { PAL } from "./gfx.js";

export const TYPES = ["CORE", "BUG", "NET", "KERNEL", "DATA", "SEC"];

// attacker -> defender -> multiplier
const EFF = {
  SEC: { BUG: 2, KERNEL: 0.5, SEC: 0.5 },
  NET: { DATA: 2, SEC: 0.5, NET: 0.5 },
  KERNEL: { NET: 2, SEC: 2, BUG: 0.5 },
  DATA: { KERNEL: 2, NET: 0.5 },
  BUG: { DATA: 2, SEC: 0.5, KERNEL: 0.5 },
  CORE: {},
};
export function typeEff(atk, def) {
  return EFF[atk]?.[def] ?? 1;
}

// effect: { stat, delta, target: "self"|"foe", chance }
export const MOVES = {
  // --- Moby ---
  tail: { name: "WHALE TAIL", type: "CORE", power: 40, acc: 100, pp: 35, desc: "A solid slap of the tail." },
  cache: { name: "LAYER CACHE", type: "CORE", power: 0, acc: 100, pp: 20, effect: { stat: "def", delta: 1, target: "self" }, desc: "Cached layers raise DEF." },
  scout: { name: "SCOUT SCAN", type: "SEC", power: 50, acc: 100, pp: 25, effect: { stat: "def", delta: -1, target: "foe", chance: 0.3 }, desc: "Scans for CVEs. Great vs BUGs." },
  compose: { name: "COMPOSE UP", type: "NET", power: 18, acc: 95, pp: 15, hits: [2, 5], desc: "Spins up 2-5 services at once." },
  volume: { name: "VOLUME MOUNT", type: "DATA", power: 75, acc: 90, pp: 15, desc: "Mounts a heavy volume on the foe." },
  health: { name: "HEALTHCHECK", type: "CORE", power: 0, acc: 100, pp: 6, heal: 0.5, desc: "Restores half of max HP." },
  kill9: { name: "KILL -9", type: "KERNEL", power: 100, acc: 85, pp: 6, desc: "Non-negotiable termination." },
  swarm: { name: "SWARM", type: "NET", power: 90, acc: 95, pp: 8, desc: "Orchestrates a whole cluster." },

  // --- Bugs & friends ---
  deref: { name: "DEREFERENCE", type: "BUG", power: 35, acc: 95, pp: 30 },
  segv: { name: "SEGFAULT", type: "BUG", power: 55, acc: 80, pp: 10 },
  fence: { name: "FENCEPOST", type: "CORE", power: 20, acc: 100, pp: 20, hits: [2, 2] },
  retry: { name: "RETRY", type: "CORE", power: 15, acc: 100, pp: 20, hits: [2, 3] },
  flake: { name: "FLAKE", type: "BUG", power: 55, acc: 65, pp: 10 },
  indent: { name: "BAD INDENT", type: "DATA", power: 35, acc: 100, pp: 20, effect: { stat: "def", delta: -1, target: "foe", chance: 0.3 } },
  tabs: { name: "TABS V SPACES", type: "CORE", power: 0, acc: 90, pp: 15, effect: { stat: "atk", delta: -1, target: "foe" } },
  unpub: { name: "UNPUBLISH", type: "DATA", power: 45, acc: 95, pp: 15 },
  bloat: { name: "BLOAT", type: "CORE", power: 0, acc: 100, pp: 15, effect: { stat: "def", delta: 1, target: "self" } },
  fork: { name: "FORK", type: "KERNEL", power: 15, acc: 90, pp: 20, hits: [2, 5] },
  defunct: { name: "DEFUNCT BITE", type: "KERNEL", power: 45, acc: 100, pp: 20 },
  orphan: { name: "ORPHAN", type: "CORE", power: 0, acc: 90, pp: 15, effect: { stat: "atk", delta: -1, target: "foe" } },
  leak: { name: "LEAK", type: "DATA", power: 40, acc: 100, pp: 15, drain: 0.5 },
  race: { name: "DATA RACE", type: "BUG", power: 50, acc: 90, pp: 15, crit: 0.25 },
  lock: { name: "MUTEX LOCK", type: "CORE", power: 0, acc: 90, pp: 15, effect: { stat: "spd", delta: -1, target: "foe" } },
  hang: { name: "HANG", type: "KERNEL", power: 60, acc: 85, pp: 10 },
  quantum: { name: "QUANTUM", type: "BUG", power: 60, acc: 75, pp: 10 },
  exploit: { name: "EXPLOIT", type: "SEC", power: 60, acc: 95, pp: 15 },
  rce: { name: "RCE", type: "SEC", power: 85, acc: 70, pp: 5 },
  recurse: { name: "RECURSE", type: "CORE", power: 22, acc: 95, pp: 15, hits: [2, 4] },
  panic: { name: "KERNEL PANIC", type: "KERNEL", power: 75, acc: 80, pp: 5 },
  // --- bosses ---
  forbid: { name: "403 FORBIDDEN", type: "NET", power: 50, acc: 95, pp: 20 },
  allow: { name: "ALLOW-LIST", type: "CORE", power: 0, acc: 100, pp: 10, effect: { stat: "def", delta: 1, target: "self" } },
  approve: { name: "APPROVAL PEND", type: "CORE", power: 0, acc: 100, pp: 10, effect: { stat: "spd", delta: -1, target: "foe" } },
  eperm: { name: "EPERM", type: "SEC", power: 65, acc: 95, pp: 20 },
  filter: { name: "SYSCALL FILTR", type: "CORE", power: 0, acc: 100, pp: 10, effect: { stat: "atk", delta: -1, target: "foe" } },
  sigkill: { name: "SIGKILL", type: "KERNEL", power: 95, acc: 75, pp: 10 },
  pressure: { name: "MEM PRESSURE", type: "KERNEL", power: 45, acc: 100, pp: 20, effect: { stat: "def", delta: -1, target: "foe", chance: 0.5 } },
  vmexit: { name: "VM EXIT", type: "KERNEL", power: 80, acc: 90, pp: 15 },
  hypercall: { name: "HYPERCALL", type: "SEC", power: 70, acc: 95, pp: 15 },
  migrate: { name: "LIVE MIGRATE", type: "CORE", power: 0, acc: 100, pp: 2, heal: 0.4 },
  nested: { name: "NESTED VIRT", type: "CORE", power: 35, acc: 100, pp: 10, hits: [2, 2] },
};

// Level-up learnset for Moby.
export const MOBY_LEARN = [
  [1, "tail"],
  [1, "cache"],
  [6, "scout"],
  [9, "compose"],
  [13, "volume"],
  [15, "health"],
  [18, "kill9"],
  [21, "swarm"],
];

export const MOBY_BASE = { hp: 80, atk: 72, def: 64, spd: 62 };

const c = (a, b, d) => ({ 1: PAL[a], 2: PAL[b], 3: PAL[d] });

export const MONS = {
  nullptr: { name: "NULL POINTER", type: "BUG", sprite: "beetle", colors: c("p", "P", "y"), base: { hp: 40, atk: 50, def: 40, spd: 55 }, xp: 50, moves: ["deref", "segv"] },
  offby1: { name: "OFF-BY-ONE", type: "BUG", sprite: "beetle", colors: c("n", "N", "m"), base: { hp: 45, atk: 45, def: 45, spd: 45 }, xp: 48, moves: ["fence", "deref"] },
  flaky: { name: "FLAKY TEST", type: "BUG", sprite: "ghost", colors: c("G", "g", "r"), base: { hp: 38, atk: 55, def: 35, spd: 60 }, xp: 50, moves: ["flake", "retry"] },
  yaml: { name: "YAML ERROR", type: "DATA", sprite: "blob", colors: c("o", "u", "y"), base: { hp: 50, atk: 45, def: 45, spd: 35 }, xp: 52, moves: ["indent", "tabs"] },
  leftpad: { name: "LEFT-PAD", type: "DATA", sprite: "box", colors: c("t", "u", "o"), base: { hp: 48, atk: 50, def: 50, spd: 30 }, xp: 52, moves: ["unpub", "bloat"] },
  zombie: { name: "ZOMBIE PROC", type: "KERNEL", sprite: "ghost", colors: c("m", "N", "r"), base: { hp: 60, atk: 60, def: 55, spd: 40 }, xp: 60, moves: ["defunct", "orphan"] },
  forkbomb: { name: "FORK BOMB", type: "KERNEL", sprite: "bomb", colors: c("K", "g", "w"), base: { hp: 45, atk: 70, def: 40, spd: 70 }, xp: 62, moves: ["fork", "hang"] },
  memleak: { name: "MEMORY LEAK", type: "DATA", sprite: "blob", colors: c("c", "C", "w"), base: { hp: 75, atk: 50, def: 55, spd: 35 }, xp: 62, moves: ["leak", "bloat"] },
  race: { name: "RACE COND", type: "BUG", sprite: "beetle", colors: c("r", "R", "y"), base: { hp: 50, atk: 65, def: 45, spd: 80 }, xp: 64, moves: ["race", "deref"] },
  deadlock: { name: "DEADLOCK", type: "KERNEL", sprite: "box", colors: c("g", "K", "y"), base: { hp: 70, atk: 55, def: 70, spd: 20 }, xp: 64, moves: ["lock", "hang"] },
  depshell: { name: "DEP HELL", type: "DATA", sprite: "box", colors: c("r", "R", "o"), base: { hp: 70, atk: 65, def: 60, spd: 40 }, xp: 70, moves: ["unpub", "leak", "bloat"] },
  heisen: { name: "HEISENBUG", type: "BUG", sprite: "ghost", colors: c("e", "p", "c"), base: { hp: 55, atk: 75, def: 50, spd: 85 }, xp: 72, moves: ["quantum", "race"] },
  cve: { name: "CVE-2026-1337", type: "SEC", sprite: "skull", colors: c("G", "g", "r"), base: { hp: 60, atk: 80, def: 55, spd: 65 }, xp: 75, moves: ["exploit", "rce"] },
  overflow: { name: "STACK OVRFLW", type: "CORE", sprite: "bomb", colors: c("o", "U", "y"), base: { hp: 65, atk: 70, def: 55, spd: 55 }, xp: 72, moves: ["recurse", "segv"] },
  kpanic: { name: "KERNEL PANIC", type: "KERNEL", sprite: "skull", colors: c("y", "o", "k"), base: { hp: 65, atk: 85, def: 55, spd: 60 }, xp: 78, moves: ["panic", "defunct"] },

  // bosses
  proxy: { name: "EGRESS PROXY", type: "NET", sprite: "firewall", boss: true, base: { hp: 95, atk: 58, def: 60, spd: 50 }, xp: 180, moves: ["forbid", "allow", "approve"] },
  seccomp: { name: "SECCOMP", type: "SEC", sprite: "shield", boss: true, base: { hp: 120, atk: 70, def: 80, spd: 55 }, xp: 200, moves: ["eperm", "filter", "deref"] },
  oom: { name: "OOM KILLER", type: "KERNEL", sprite: "reaper", boss: true, base: { hp: 125, atk: 85, def: 70, spd: 65 }, xp: 220, moves: ["sigkill", "pressure", "defunct"] },
  hyper: { name: "HYPERVISOR", type: "SEC", sprite: "monolith", boss: true, base: { hp: 150, atk: 88, def: 85, spd: 70 }, xp: 300, moves: ["vmexit", "hypercall", "nested", "migrate"] },
};

export const ITEMS = {
  restart: { name: "RESTART", heal: 30, desc: "docker restart. Heals 30 HP." },
  hotfix: { name: "HOTFIX", heal: 90, desc: "Emergency patch. Heals 90 HP." },
  rebuild: { name: "REBUILD", heal: 9999, desc: "--no-cache. Full HP." },
};

export function calcStats(base, level, boss = false) {
  const s = (b) => Math.floor((b * 2 * level) / 100) + 5;
  const hp = Math.floor((base.hp * 2 * level) / 100) + level + 10;
  return { hp: boss ? Math.floor(hp * 1.6) : hp, atk: s(base.atk), def: s(base.def), spd: s(base.spd) };
}

export function xpForLevel(l) {
  return Math.floor(0.8 * l * l * l);
}

export function makeFoe(id, level) {
  const m = MONS[id];
  const stats = calcStats(m.base, level, m.boss);
  return {
    id, name: m.name, type: m.type, level, boss: !!m.boss,
    ...stats, maxhp: stats.hp,
    moves: m.moves.map((mv) => ({ id: mv, pp: MOVES[mv].pp })),
  };
}
