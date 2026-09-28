// Turn-based battles.
import { PAL, TEXT_FG, TEXT_BG } from "./gfx.js";
import { MOVES, MONS, ITEMS, MOBY_LEARN, typeEff, makeFoe, xpForLevel } from "./data.js";
import { MON_SPRITES, MOBY_BATTLE } from "./sprites.js";
import { recalcMoby } from "./state.js";
import { wrapText } from "./engine.js";

const BG = 0xe6efdc;
const PLATFORM = 0xb9cfa4;
const PLATFORM_EDGE = 0x8fae78;

const FOE_POS = { x: 58, y: 4 };
const BOSS_POS = { x: 56, y: 1 };
const MOBY_POS = { x: 6, y: 25 };

const TYPE_COLORS = { CORE: PAL.g, BUG: PAL.n, NET: PAL.b, KERNEL: PAL.r, DATA: PAL.o, SEC: PAL.p };

const DEFEAT_VERB = {
  BUG: "was squashed!",
  KERNEL: "was reaped!",
  DATA: "was garbage collected!",
  SEC: "was patched!",
  NET: "was bypassed!",
  CORE: "was refactored away!",
};

const STAT_NAMES = { atk: "ATK", def: "DEF", spd: "SPD" };

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const stageMul = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

function hpColor(r) {
  if (r > 0.5) return 0x38b24a;
  if (r > 0.2) return 0xf2b705;
  return 0xe63946;
}

function drawBar(s, col, row, cells, ratio, color, empty = 0x3a4252) {
  const halves = Math.round(Math.max(0, Math.min(1, ratio)) * cells * 2);
  for (let i = 0; i < cells; i++) {
    const h = halves - i * 2;
    if (h >= 2) s.cell(col + i, row, "█", color, empty);
    else if (h === 1) s.cell(col + i, row, "▌", color, empty);
    else s.cell(col + i, row, " ", color, empty);
  }
}

class BattleScene {
  constructor(game, opts) {
    this.game = game;
    this.opts = opts;
    this.moby = game.state.moby;
    this.foe = null;
    this.foeX = -24;
    this.mobyX = 84;
    this.foeY = 0;
    this.mobyY = 0;
    this.foeHidden = false;
    this.mobyHidden = false;
    this.showFoeInfo = false;
    this.showMobyInfo = false;
    this.foeHp = 0;
    this.mobyHp = this.moby.hp;
    this.xpShown = this.moby.xp;
    this.fx = null;
    this.shake = 0;
    this.stages = { moby: { atk: 0, def: 0, spd: 0 }, foe: { atk: 0, def: 0, spd: 0 } };
  }

  setFoe(foe) {
    this.foe = foe;
    this.foeHp = foe.hp;
    this.stages.foe = { atk: 0, def: 0, spd: 0 };
  }

  foeSprite() {
    return MON_SPRITES[MONS[this.foe.id].sprite];
  }

  foeName(cap = true) {
    const n = this.foe.name;
    if (this.foe.boss) return n;
    if (this.opts.trainer) return (cap ? "Foe " : "foe ") + n;
    return (cap ? "Wild " : "wild ") + n;
  }

  update() {}

  render(s, game) {
    s.clear(BG);
    // subtle scanline texture
    for (let y = 0; y < 44; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 80; x += 4) s.pset(x, y, 0xdde8d2);
    // platforms
    s.ellipse(66, 20, 15, 3, PLATFORM_EDGE);
    s.ellipse(66, 20, 14, 2, PLATFORM);
    s.ellipse(19, 41, 18, 3, PLATFORM_EDGE);
    s.ellipse(19, 41, 17, 2, PLATFORM);

    const shake = this.shake ? Math.round(Math.sin(game.time / 20) * 2) : 0;
    if (this.foe && !this.foeHidden) {
      const sp = this.foeSprite();
      const pos = this.foe.boss ? BOSS_POS : FOE_POS;
      const baseX = this.foeX + (this.foe.boss ? BOSS_POS.x - FOE_POS.x : 0);
      const bob = this.foe.boss ? Math.round(Math.sin(game.time / 400)) : 0;
      s.sprite(sp, baseX + shake, pos.y + this.foeY + bob, {
        map: MONS[this.foe.id].colors,
        solid: this.foeFlash ? PAL.w : undefined,
        clipBottom: pos.y + sp.h,
      });
    }
    if (!this.mobyHidden) {
      s.sprite(MOBY_BATTLE, this.mobyX, MOBY_POS.y + this.mobyY, {
        solid: this.mobyFlash ? PAL.w : undefined,
        clipBottom: MOBY_POS.y + MOBY_BATTLE.h,
      });
      // little waves
      for (let x = 0; x < 38; x++) {
        const y = 42 + Math.round(Math.sin((x + game.time / 120) / 2));
        if (x % 3 !== 0) s.pset(x, y, PAL.l);
      }
    }
    this.fx?.(s);

    // Foe info
    if (this.showFoeInfo && this.foe) {
      const f = this.foe;
      s.text(2, 1, f.name, TEXT_FG, BG);
      s.text(2, 2, `:L${f.level}`, TEXT_FG, BG);
      s.text(9, 2, f.type, TYPE_COLORS[f.type], BG);
      s.text(2, 3, "HP", PAL.o, BG);
      drawBar(s, 5, 3, 20, this.foeHp / f.maxhp, hpColor(this.foeHp / f.maxhp));
      s.cell(1, 1, "│", TEXT_FG, BG);
      s.cell(1, 2, "│", TEXT_FG, BG);
      s.cell(1, 3, "│", TEXT_FG, BG);
      s.cell(1, 4, "└", TEXT_FG, BG);
      for (let i = 2; i < 27; i++) s.cell(i, 4, "─", TEXT_FG, BG);
      s.cell(27, 4, "▶", TEXT_FG, BG);
    }
    // Moby info
    if (this.showMobyInfo) {
      const m = this.moby;
      s.text(46, 15, "MOBY", TEXT_FG, BG);
      s.text(70, 15, `:L${m.level}`.padStart(5), TEXT_FG, BG);
      s.text(46, 16, "HP", PAL.o, BG);
      const hp = Math.max(0, Math.round(this.mobyHp));
      drawBar(s, 49, 16, 26, this.mobyHp / m.maxhp, hpColor(this.mobyHp / m.maxhp));
      s.text(64, 17, `${String(hp).padStart(3)}/${String(m.maxhp).padStart(3)}`, TEXT_FG, BG);
      s.text(46, 18, "XP", PAL.b, BG);
      const lo = xpForLevel(m.level);
      const hi = xpForLevel(m.level + 1);
      drawBar(s, 49, 18, 26, (this.xpShown - lo) / (hi - lo), PAL.c, 0xc9d6c0);
      for (let r = 15; r <= 18; r++) s.cell(77, r, "│", TEXT_FG, BG);
      s.cell(77, 19, "┘", TEXT_FG, BG);
      for (let i = 46; i < 77; i++) s.cell(i, 19, "─", TEXT_FG, BG);
      s.cell(45, 19, "◀", TEXT_FG, BG);
    }
  }
}

// ---------- effects ----------
function playFx(bs, type, fromMoby) {
  const g = bs.game;
  const from = fromMoby ? { x: 26, y: 30 } : { x: 64, y: 10 };
  const to = fromMoby ? { x: 66, y: 12 } : { x: 19, y: 33 };
  const col = TYPE_COLORS[type] ?? PAL.k;
  return g.tween(420, (t) => {
    bs.fx = (s) => {
      if (t >= 1) return;
      if (type === "SEC") {
        const y = Math.round(to.y - 10 + t * 20);
        for (let x = to.x - 12; x <= to.x + 12; x++) s.pset(x, y, PAL.c), s.pset(x, y + 1, PAL.p);
      } else if (type === "NET") {
        for (let k = 0; k < 4; k++) {
          const tt = Math.max(0, Math.min(1, t * 1.6 - k * 0.2));
          const x = from.x + (to.x - from.x) * tt;
          const y = from.y + (to.y - from.y) * tt - Math.sin(tt * Math.PI) * 8;
          s.rect(x - 2, y - 1, 4, 3, PAL.b);
          s.rect(x - 1, y, 2, 1, PAL.l);
        }
      } else if (type === "DATA") {
        for (let k = 0; k < 5; k++) {
          const x = to.x - 10 + k * 5;
          const y = to.y - 16 + ((t * 28 + k * 5) % 22);
          s.rect(x, y, 3, 3, k % 2 ? PAL.o : PAL.y);
        }
      } else if (type === "KERNEL") {
        let x = to.x - 2;
        for (let y = to.y - 14; y < to.y + 6; y++) {
          x += ((y * 7) % 3) - 1;
          if (y < to.y - 14 + t * 30) s.pset(x, y, PAL.r), s.pset(x + 1, y, PAL.y);
        }
      } else if (type === "BUG") {
        for (let k = 0; k < 12; k++) {
          const a = k * 0.52 + t * 9;
          const r = 10 * (1 - t) + 2;
          s.pset(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r * 0.7, k % 2 ? PAL.n : PAL.k);
        }
      } else {
        const r = Math.round(2 + t * 7);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          s.pset(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r * 0.7, col);
          s.pset(to.x + Math.cos(a) * (r - 1), to.y + Math.sin(a) * (r - 1) * 0.7, PAL.y);
        }
      }
    };
  }).then(() => (bs.fx = null));
}

async function blink(bs, who) {
  const key = who === "foe" ? "foeHidden" : "mobyHidden";
  for (let i = 0; i < 3; i++) {
    bs[key] = true;
    await bs.game.wait(70);
    bs[key] = false;
    await bs.game.wait(70);
  }
}

async function lunge(bs, fromMoby) {
  const key = fromMoby ? "mobyX" : "foeX";
  const base = bs[key];
  const dir = fromMoby ? 1 : -1;
  await bs.game.tween(90, (t) => (bs[key] = base + dir * 5 * t));
  await bs.game.tween(90, (t) => (bs[key] = base + dir * 5 * (1 - t)));
}

async function animateHp(bs, who, to) {
  const key = who === "foe" ? "foeHp" : "mobyHp";
  const from = bs[key];
  const ms = Math.min(700, 120 + Math.abs(from - to) * 25);
  await bs.game.tween(ms, (t) => (bs[key] = from + (to - from) * t));
}

// ---------- menus ----------
function actionMenu(bs, index) {
  const g = bs.game;
  g.prompt("What will MOBY do?");
  const items = ["FIGHT", "BAG", "MOBY", "RUN"];
  return g.menu(items, {
    cols: 2, index, cancel: false,
    render: (s, m) => {
      s.box(46, 22, 34, 8);
      items.forEach((it, i) => {
        const x = 50 + (i % 2) * 14;
        const y = 24 + Math.floor(i / 2) * 2;
        s.text(x, y, (m.index === i ? "▶" : " ") + it);
      });
    },
  });
}

function fightMenu(bs, index) {
  const g = bs.game;
  const moves = bs.moby.moves;
  const labels = moves.map((mv) => MOVES[mv.id].name);
  return g.menu(labels, {
    index: Math.min(index, moves.length - 1),
    disabled: (i) => moves[i].pp <= 0,
    render: (s, m) => {
      s.box(0, 22, 44, 8);
      labels.forEach((l, i) => {
        const dis = moves[i].pp <= 0;
        s.text(3, 24 + i, (m.index === i ? "▶" : " ") + l, dis ? PAL.g : TEXT_FG);
      });
      const mv = MOVES[moves[m.index].id];
      s.box(44, 22, 36, 8);
      s.text(46, 23, "TYPE/");
      s.text(52, 23, mv.type, TYPE_COLORS[mv.type]);
      s.text(62, 23, `PP ${String(moves[m.index].pp).padStart(2)}/${mv.pp}`);
      s.text(46, 24, mv.power ? `POW ${mv.power}${mv.hits ? "x" + mv.hits.join("-") : ""}` : "POW --");
      s.text(62, 24, `ACC ${mv.acc}`);
      if (bs.foe) {
        const e = typeEff(mv.type, bs.foe.type);
        if (mv.power && e !== 1) s.text(46, 25, e > 1 ? "Super effective!" : "Not very effective", e > 1 ? 0x2a8a3a : PAL.R);
      }
      wrapText(mv.desc ?? "", 32).slice(0, 2).forEach((line, i) => s.text(46, 26 + i, line, PAL.K));
    },
  });
}

function bagList(state) {
  return Object.entries(state.bag).filter(([, n]) => n > 0);
}

export function bagMenu(game) {
  const list = bagList(game.state);
  if (!list.length) return Promise.resolve(null);
  const labels = list.map(([id, n]) => `${ITEMS[id].name.padEnd(9)} x${n}`).concat(["CANCEL"]);
  return game
    .menu(labels, {
      x: 44, y: 0, w: 36,
      render: (s, m) => {
        s.box(44, 0, 36, labels.length + 5);
        labels.forEach((l, i) => s.text(46, 1 + i, (m.index === i ? "▶" : " ") + l));
        const it = list[m.index];
        const desc = it ? ITEMS[it[0]].desc : "Close the bag.";
        wrapText(desc, 32).slice(0, 2).forEach((line, i) => s.text(46, labels.length + 2 + i, line, PAL.K));
      },
    })
    .then((i) => (i < 0 || i >= list.length ? null : list[i][0]));
}

export function statsView(game) {
  const m = game.state.moby;
  return game.menu(["OK"], {
    render: (s) => {
      s.box(0, 0, 80, 22);
      // pixel window for the sprite (cells would cover it)
      s.rect(2, 2, 30, 20, TEXT_BG);
      for (let r = 1; r < 11; r++) for (let c = 2; c < 32; c++) s.cells[r * 80 + c] = null;
      s.sprite(MOBY_BATTLE, 4, 3);
      s.text(36, 2, "MOBY", PAL.b);
      s.text(44, 2, `Lv${m.level}   TYPE/CORE`);
      s.text(36, 4, `HP   ${m.hp}/${m.maxhp}`);
      s.text(36, 5, `ATK  ${m.atk}`);
      s.text(36, 6, `DEF  ${m.def}`);
      s.text(36, 7, `SPD  ${m.spd}`);
      s.text(36, 9, `XP   ${m.xp}`);
      s.text(36, 10, `NEXT ${xpForLevel(m.level + 1) - m.xp}`);
      s.text(3, 13, "MOVES", PAL.o);
      m.moves.forEach((mv, i) => {
        const d = MOVES[mv.id];
        s.text(3, 14 + i, `${d.name.padEnd(14)}`);
        s.text(18, 14 + i, d.type, TYPE_COLORS[d.type]);
        s.text(26, 14 + i, `PP ${mv.pp}/${d.pp}`);
      });
      s.text(40, 13, "ID CARD", PAL.o);
      s.text(40, 14, "Image:  moby:latest");
      s.text(40, 15, "Runtime: sbx microVM");
      s.text(40, 16, "Network: deny-by-default");
      s.text(40, 17, "Status: CONTAINED");
      s.text(3, 20, "Press A or B to close", PAL.g);
    },
  });
}

// ---------- core mechanics ----------
export function calcDamage(att, def, attSt, defSt, mv) {
  const A = att.atk * stageMul(attSt.atk);
  const D = def.def * stageMul(defSt.def);
  const base = Math.floor(Math.floor(((2 * att.level) / 5 + 2) * mv.power * A / D) / 50) + 2;
  const eff = typeEff(mv.type, def.type);
  const stab = mv.type === att.type ? 1.5 : 1;
  const crit = Math.random() < (mv.crit ?? 1 / 16);
  const rnd = 0.85 + Math.random() * 0.15;
  return { dmg: Math.max(1, Math.floor(base * eff * stab * (crit ? 1.5 : 1) * rnd)), eff, crit };
}

async function doMove(bs, isMoby, slot) {
  const g = bs.game;
  const user = isMoby ? bs.moby : bs.foe;
  const target = isMoby ? bs.foe : bs.moby;
  const mv = MOVES[slot.id];
  slot.pp = Math.max(0, slot.pp - 1);
  const uname = isMoby ? "MOBY" : bs.foeName();
  const tname = isMoby ? bs.foeName(true) : "MOBY";
  await g.say(`${uname} used ${mv.name}!`);

  if (Math.random() * 100 >= mv.acc) {
    await g.say(isMoby ? "But the request timed out!" : `But MOBY dodged it!`);
    return;
  }

  if (mv.heal) {
    const amt = Math.min(user.maxhp - user.hp, Math.ceil(user.maxhp * mv.heal));
    if (amt <= 0) {
      await g.say("But HP is already full!");
      return;
    }
    user.hp += amt;
    await animateHp(bs, isMoby ? "moby" : "foe", user.hp);
    await g.say(`${uname} restored ${amt} HP!`);
    return;
  }

  if (mv.power > 0) {
    await lunge(bs, isMoby);
    const nHits = mv.hits ? rand(mv.hits[0], mv.hits[1]) : 1;
    let hits = 0;
    let lastEff = 1;
    let crits = 0;
    let total = 0;
    for (let i = 0; i < nHits && target.hp > 0; i++) {
      await playFx(bs, mv.type, isMoby);
      const r = calcDamage(user, target, bs.stages[isMoby ? "moby" : "foe"], bs.stages[isMoby ? "foe" : "moby"], mv);
      lastEff = r.eff;
      if (r.crit) crits++;
      const dmg = Math.min(target.hp, r.dmg);
      target.hp -= dmg;
      total += dmg;
      hits++;
      if (!isMoby) bs.shake = 1;
      await Promise.all([blink(bs, isMoby ? "foe" : "moby"), animateHp(bs, isMoby ? "foe" : "moby", target.hp)]);
      bs.shake = 0;
    }
    if (nHits > 1) await g.say(`Hit ${hits} time${hits > 1 ? "s" : ""}!`);
    if (crits) await g.say("A critical hit!");
    if (lastEff > 1) await g.say("It's super effective!");
    else if (lastEff < 1) await g.say("It's not very effective...");
    if (mv.drain && total > 0 && user.hp < user.maxhp) {
      const amt = Math.min(user.maxhp - user.hp, Math.ceil(total * mv.drain));
      user.hp += amt;
      await animateHp(bs, isMoby ? "moby" : "foe", user.hp);
      await g.say(`${uname} leaked ${amt} HP from ${tname}!`);
    }
  }

  const ef = mv.effect;
  if (ef && target.hp > 0 && (ef.chance === undefined || Math.random() < ef.chance)) {
    const selfTarget = ef.target === "self";
    const who = (selfTarget ? isMoby : !isMoby) ? "moby" : "foe";
    const whoName = who === "moby" ? "MOBY" : bs.foeName();
    const st = bs.stages[who];
    const nv = Math.max(-6, Math.min(6, st[ef.stat] + ef.delta));
    if (nv === st[ef.stat]) {
      if (!mv.power) await g.say(`Nothing happened! ${whoName}'s ${STAT_NAMES[ef.stat]} won't go any ${ef.delta > 0 ? "higher" : "lower"}!`);
    } else {
      st[ef.stat] = nv;
      await g.say(`${whoName}'s ${STAT_NAMES[ef.stat]} ${ef.delta > 0 ? "rose" : "fell"}!`);
    }
  }
}

export function foeChoose(foe) {
  const usable = foe.moves.filter((m) => m.pp > 0);
  if (!usable.length) return { id: "tail", pp: 99 };
  const heals = usable.filter((m) => MOVES[m.id].heal);
  if (heals.length && foe.hp < foe.maxhp * 0.45 && Math.random() < 0.6) return heals[0];
  const status = usable.filter((m) => !MOVES[m.id].power && !MOVES[m.id].heal);
  const attacks = usable.filter((m) => MOVES[m.id].power);
  if (status.length && (Math.random() < 0.22 || !attacks.length)) return status[rand(0, status.length - 1)];
  if (!attacks.length) return usable[0];
  return attacks[rand(0, attacks.length - 1)];
}

async function learnMoves(g, moby, level) {
  for (const [lv, id] of MOBY_LEARN) {
    if (lv !== level || moby.moves.some((m) => m.id === id)) continue;
    const mv = MOVES[id];
    if (moby.moves.length < 4) {
      moby.moves.push({ id, pp: mv.pp });
      await g.say(`MOBY learned ${mv.name}!`);
      continue;
    }
    await g.say(`MOBY wants to learn ${mv.name}. But MOBY already knows 4 moves. Forget one?`);
    g.prompt(`Which move should be forgotten for ${mv.name}?`);
    const labels = moby.moves.map((m) => MOVES[m.id].name).concat([`SKIP ${mv.name}`]);
    const i = await g.menu(labels, { x: 50, y: 6, index: 4 });
    g.closeDialog();
    if (i < 0 || i === 4) {
      await g.say(`MOBY did not learn ${mv.name}.`);
    } else {
      const old = MOVES[moby.moves[i].id].name;
      moby.moves[i] = { id, pp: mv.pp };
      await g.say(`1, 2 and... poof! MOBY forgot ${old}. And... MOBY learned ${mv.name}!`);
    }
  }
}

async function awardXp(bs) {
  const g = bs.game;
  const m = bs.moby;
  const foe = bs.foe;
  const mult = bs.opts.trainer || foe.boss ? 1.5 : 1;
  const gain = Math.max(1, Math.floor((MONS[foe.id].xp * foe.level) / 6 * mult));
  await g.say(`MOBY gained ${gain} XP!`);
  const target = m.xp + gain;
  while (m.xp < target) {
    const next = xpForLevel(m.level + 1);
    const to = Math.min(target, next);
    const from = bs.xpShown;
    await g.tween(400, (t) => (bs.xpShown = from + (to - from) * t));
    m.xp = to;
    if (m.xp >= next) {
      m.level++;
      const oldHp = m.maxhp;
      recalcMoby(m);
      bs.mobyHp = m.hp;
      bs.xpShown = m.xp;
      await g.say(`MOBY grew to level ${m.level}! (max HP +${m.maxhp - oldHp})`);
      await learnMoves(g, m, m.level);
    }
  }
  bs.xpShown = m.xp;
}

// ---------- entry point ----------
// opts: { foes: [{id, level}], trainer?: "NAME", intro?: string }
export async function runBattle(game, opts) {
  const prevScene = game.scene;
  // encounter transition
  for (let i = 0; i < 3; i++) {
    await game.fadeOut(70, PAL.w);
    await game.fadeIn(70);
  }
  await game.tween(450, (t) => {
    game.overlays = [
      (s) => {
        const n = Math.round(t * 30);
        for (let y = 0; y < 60; y++) {
          const band = Math.floor(y / 6);
          const w = band % 2 ? n * 3 : n * 3;
          if (band % 2) s.rect(80 - w, y, w, 1, PAL.k);
          else s.rect(0, y, w, 1, PAL.k);
        }
        s.cells.fill(null);
      },
    ];
  });
  game.overlays = [];

  const bs = new BattleScene(game, opts);
  const foes = opts.foes.map((f) => makeFoe(f.id, f.level));
  bs.setFoe(foes[0]);
  game.scene = bs;
  await game.tween(700, (t) => {
    bs.foeX = -24 + (FOE_POS.x + 24) * t;
    bs.mobyX = 84 - (84 - MOBY_POS.x) * t;
  });

  if (opts.trainer) {
    await game.say(opts.intro ?? `${opts.trainer} wants to fight!`);
    await game.say(`${opts.trainer} sent out ${bs.foe.name}!`);
  } else if (bs.foe.boss) {
    await game.say(opts.intro ?? `${bs.foe.name} blocks the way!`);
  } else {
    await game.say(`A wild ${bs.foe.name} appeared!`);
  }
  bs.showFoeInfo = true;
  await game.say("Go! MOBY!", { auto: 350 });
  bs.showMobyInfo = true;

  let foeIdx = 0;
  let actIdx = 0;
  let moveIdx = 0;
  let runs = 0;
  let result = null;

  while (!result) {
    const act = await actionMenu(bs, actIdx);
    game.closeDialog();
    actIdx = act;
    let mobyAction = null;

    if (act === 0) {
      if (bs.moby.moves.every((m) => m.pp <= 0)) {
        await game.say("MOBY has no PP left! MOBY flails its tail!");
        mobyAction = { kind: "move", slot: { id: "tail", pp: 99 } };
      } else {
        const i = await fightMenu(bs, moveIdx);
        if (i < 0) continue;
        moveIdx = i;
        mobyAction = { kind: "move", slot: bs.moby.moves[i] };
      }
    } else if (act === 1) {
      const item = await bagMenu(game);
      if (!item) {
        if (!bagList(game.state).length) await game.say("The BAG is empty!");
        continue;
      }
      mobyAction = { kind: "item", item };
    } else if (act === 2) {
      await statsView(game);
      continue;
    } else if (act === 3) {
      if (bs.foe.boss) {
        await game.say(`${bs.foe.name} blocks every exit. There's no escaping... this sandbox.`);
        continue;
      }
      if (opts.trainer) {
        await game.say("No! There's no running from a trainer battle!");
        continue;
      }
      runs++;
      const chance = bs.moby.spd >= bs.foe.spd ? 1 : 0.5 + runs * 0.2;
      if (Math.random() < chance) {
        await game.say("docker stop... Got away safely!");
        result = "run";
        break;
      }
      await game.say("Can't escape!");
      mobyAction = { kind: "none" };
    }

    // turn order
    const foeSlot = foeChoose(bs.foe);
    const mSpd = bs.moby.spd * stageMul(bs.stages.moby.spd);
    const fSpd = bs.foe.spd * stageMul(bs.stages.foe.spd);
    const mobyFirst = mobyAction.kind !== "move" || mSpd > fSpd || (mSpd === fSpd && Math.random() < 0.5);
    const turns = mobyFirst ? ["moby", "foe"] : ["foe", "moby"];

    for (const who of turns) {
      if (bs.moby.hp <= 0 || bs.foe.hp <= 0) break;
      if (who === "moby") {
        if (mobyAction.kind === "move") await doMove(bs, true, mobyAction.slot);
        else if (mobyAction.kind === "item") {
          const it = ITEMS[mobyAction.item];
          game.state.bag[mobyAction.item]--;
          const amt = Math.min(bs.moby.maxhp - bs.moby.hp, it.heal);
          bs.moby.hp += amt;
          await game.say(`MOBY used ${it.name}!`);
          await animateHp(bs, "moby", bs.moby.hp);
          await game.say(amt > 0 ? `MOBY recovered ${amt} HP!` : "It had no effect...");
        }
      } else {
        await doMove(bs, false, foeSlot);
      }
    }

    if (bs.foe.hp <= 0) {
      await game.tween(350, (t) => (bs.foeY = Math.round(t * 22)));
      bs.foeHidden = true;
      await game.say(`${bs.foeName()} ${DEFEAT_VERB[bs.foe.type]}`);
      await awardXp(bs);
      foeIdx++;
      if (foeIdx < foes.length) {
        bs.setFoe(foes[foeIdx]);
        bs.foeY = 0;
        bs.foeHidden = false;
        bs.showFoeInfo = false;
        await game.tween(300, (t) => (bs.foeX = 84 - (84 - FOE_POS.x) * t));
        await game.say(`${opts.trainer} sent out ${bs.foe.name}!`);
        bs.showFoeInfo = true;
      } else {
        if (opts.trainer) await game.say(`MOBY defeated ${opts.trainer}!`);
        game.state.wins++;
        result = "win";
      }
    } else if (bs.moby.hp <= 0) {
      await game.tween(350, (t) => (bs.mobyY = Math.round(t * 20)));
      bs.mobyHidden = true;
      await game.say("MOBY crashed! Container exited with code 137.");
      result = "lose";
    }
  }

  await game.fadeOut(300);
  game.closeDialog();
  game.scene = prevScene;
  return result;
}
