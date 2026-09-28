// Overworld: tile maps, movement, NPCs, trainers, warps.
import { PAL } from "./gfx.js";
import { TILES, MOBY_OW, PERSON, GORDON, ITEMBOX, BOSS_OW, EMOTE } from "./sprites.js";
import { runBattle, bagMenu, statsView } from "./battle.js";
import { ITEMS } from "./data.js";
import { healMoby, saveGame } from "./state.js";

const SOLID = new Set(["#", "R", "C", "~", "T", "H", "S", "="]);
const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const STEP_MS = 170;
const CONTAINER_COLORS = [
  { 1: 0x2f7de1, 2: 0x0b3b8f },
  { 1: 0xe0533d, 2: 0x8a1c2b },
  { 1: 0xf29a2e, 2: 0x9a5a12 },
  { 1: 0x3fa65a, 2: 0x1e6b37 },
];

export class Overworld {
  constructor(game, maps) {
    this.game = game;
    this.maps = maps;
    this.moving = null;
    this.walkT = 0;
    this.emote = null;
    this.lastHorizontal = "right";
  }

  get state() {
    return this.game.state;
  }

  load(id, x, y, facing) {
    const st = this.state;
    st.map = id;
    st.x = x;
    st.y = y;
    if (facing) st.facing = facing;
    this.map = this.maps[id];
    this.entities = (this.map.entities ?? []).map((e) => ({ ...e, ox: 0, oy: 0, cx: e.x, cy: e.y }));
    this.moving = null;
  }

  // ---- queries ----
  tile(x, y) {
    const g = this.map.grid;
    if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) return this.map.border ?? "#";
    return g[y][x];
  }

  visible(e) {
    return !e.visible || e.visible(this.state.flags);
  }

  entityAt(x, y) {
    return this.entities.find((e) => this.visible(e) && e.cx === x && e.cy === y);
  }

  blocked(x, y) {
    return SOLID.has(this.tile(x, y)) || !!this.entityAt(x, y);
  }

  // ---- update ----
  update(dt) {
    const g = this.game;
    if (this.moving) {
      this.moving.t += dt / STEP_MS;
      this.walkT += dt;
      if (this.moving.t >= 1) {
        this.moving = null;
        this.onStep();
      }
      return;
    }
    if (g.busy || g.dialog || g.menus.length) return;
    const d = g.input.heldDir();
    if (d) this.tryMove(d);
  }

  tryMove(dir) {
    const st = this.state;
    st.facing = dir;
    if (dir === "left" || dir === "right") this.lastHorizontal = dir;
    const [dx, dy] = DIR[dir];
    const nx = st.x + dx;
    const ny = st.y + dy;
    if (this.blocked(nx, ny)) {
      this.bumpT = this.game.time;
      return;
    }
    this.moving = { fx: st.x, fy: st.y, t: 0 };
    st.x = nx;
    st.y = ny;
    st.steps++;
  }

  onKey(act) {
    if (this.moving) return;
    if (act in DIR) {
      this.tryMove(act);
      return;
    }
    if (act === "a") this.interact();
    if (act === "start") this.game.run(() => this.pauseMenu());
  }

  onStep() {
    const st = this.state;
    const key = `${st.x},${st.y}`;
    const warp = this.map.warps?.find((w) => w.x === st.x && w.y === st.y);
    if (warp) {
      this.game.run(() => this.warp(warp));
      return;
    }
    const trig = this.map.triggers?.[key];
    if (trig) {
      this.game.run(() => trig(this));
      return;
    }
    if (this.checkTrainers()) return;
    const enc = this.map.encounters;
    if (enc && this.tile(st.x, st.y) === "," && Math.random() < enc.rate) {
      const total = enc.table.reduce((a, r) => a + r[3], 0);
      let r = Math.random() * total;
      const row = enc.table.find((t) => (r -= t[3]) < 0) ?? enc.table[0];
      const level = row[1] + Math.floor(Math.random() * (row[2] - row[1] + 1));
      this.game.run(() => this.battle({ foes: [{ id: row[0], level }] }));
    }
  }

  checkTrainers() {
    const st = this.state;
    for (const e of this.entities) {
      if (!e.trainer || !this.visible(e) || st.flags[`beat_${e.id}`]) continue;
      const [dx, dy] = DIR[e.facing];
      for (let i = 1; i <= (e.trainer.sight ?? 4); i++) {
        const tx = e.cx + dx * i;
        const ty = e.cy + dy * i;
        if (tx === st.x && ty === st.y) {
          this.game.run(() => this.trainerSpotted(e, i));
          return true;
        }
        if (SOLID.has(this.tile(tx, ty)) || this.entityAt(tx, ty)) break;
      }
    }
    return false;
  }

  async trainerSpotted(e, dist) {
    const g = this.game;
    this.emote = e;
    await g.wait(700);
    this.emote = null;
    const [dx, dy] = DIR[e.facing];
    for (let i = 1; i < dist; i++) {
      await g.tween(STEP_MS, (t) => {
        e.ox = dx * 8 * t;
        e.oy = dy * 8 * t;
      });
      e.cx += dx;
      e.cy += dy;
      e.ox = e.oy = 0;
    }
    const back = { up: "down", down: "up", left: "right", right: "left" };
    this.state.facing = back[e.facing];
    if (this.state.facing === "left" || this.state.facing === "right") this.lastHorizontal = this.state.facing;
    await this.trainerBattle(e);
  }

  async trainerBattle(e) {
    const g = this.game;
    const tr = e.trainer;
    for (const line of tr.before) await g.say(line);
    const r = await this.battle({ foes: tr.foes, trainer: tr.name });
    if (r === "win") {
      this.state.flags[`beat_${e.id}`] = true;
      for (const line of tr.after) await g.say(line);
      if (tr.reward) await this.giveItem(tr.reward[0], tr.reward[1]);
    }
  }

  async interact() {
    const st = this.state;
    const [dx, dy] = DIR[st.facing];
    const tx = st.x + dx;
    const ty = st.y + dy;
    const key = `${tx},${ty}`;
    const e = this.entityAt(tx, ty);
    const g = this.game;
    if (e) {
      if (e.trainer && !st.flags[`beat_${e.id}`]) return g.run(() => this.trainerBattle(e));
      if (e.item) {
        return g.run(async () => {
          st.flags[`got_${e.id}`] = true;
          await this.giveItem(e.item[0], e.item[1]);
        });
      }
      if (e.talk) return g.run(() => e.talk(this, e));
      return;
    }
    const t = this.tile(tx, ty);
    const text = this.map.texts?.[key];
    if (t === "H") return g.run(() => this.healStation(st.x, st.y));
    if (text) return g.run(async () => {
      for (const line of [].concat(text)) await g.say(line);
    });
    if (t === "T") return g.run(() => g.say("A terminal. The cursor blinks patiently."));
    if (t === "R") return g.run(() => g.say("A server rack. The fans hum a sandboxed lullaby."));
    if (t === "C") return g.run(() => g.say("A stack of shipping containers. MOBY feels at home."));
    if (t === "~") return g.run(() => g.say("A data lake. Nobody knows what's at the bottom."));
    if (t === "=") return g.run(() => g.say("The firewall crackles. DENY ALL."));
  }

  async giveItem(id, n = 1) {
    const st = this.state;
    st.bag[id] = (st.bag[id] ?? 0) + n;
    await this.game.say(`MOBY found ${n > 1 ? n + "x " : ""}${ITEMS[id].name}! (${ITEMS[id].desc})`);
  }

  async healStation(x, y) {
    const g = this.game;
    await g.say("RESTART STATION: $ docker restart moby");
    await g.fadeOut(250, PAL.w);
    healMoby(this.state);
    this.state.respawn = { map: this.state.map, x, y };
    await g.wait(250);
    await g.fadeIn(250);
    await g.say("MOBY's HP and PP were fully restored! This is now MOBY's restart point.");
  }

  async warp(w) {
    const g = this.game;
    await g.fadeOut(220);
    this.load(w.to, w.tx, w.ty, w.facing);
    this.bannerUntil = g.time + 1800;
    await this.map.onEnter?.(this);
    await g.fadeIn(220);
    if (this.map.afterEnter) await this.map.afterEnter(this);
  }

  // Runs a battle and handles defeat (respawn). Returns "win" | "lose" | "run".
  async battle(opts) {
    const g = this.game;
    const r = await runBattle(g, opts);
    if (r === "lose") {
      const rs = this.state.respawn;
      this.load(rs.map, rs.x, rs.y, "up");
      healMoby(this.state);
      await g.wait(400);
      await g.fadeIn(400);
      await g.say("$ docker restart moby ... MOBY was restarted at the last RESTART STATION.");
    } else {
      await g.fadeIn(300);
    }
    return r;
  }

  async pauseMenu() {
    const g = this.game;
    for (;;) {
      const i = await g.menu(["MOBY", "BAG", "SAVE", "CONTROLS", "CLOSE", "QUIT"], { x: 60, y: 0, w: 20 });
      if (i === 0) await statsView(g);
      if (i === 1) {
        const item = await bagMenu(g);
        if (!item && !Object.values(this.state.bag).some((n) => n > 0)) await g.say("The BAG is empty.");
        if (item) {
          const m = this.state.moby;
          const it = ITEMS[item];
          if (m.hp >= m.maxhp) {
            await g.say("MOBY is already at full HP.");
          } else {
            this.state.bag[item]--;
            const amt = Math.min(m.maxhp - m.hp, it.heal);
            m.hp += amt;
            await g.say(`Used ${it.name}. MOBY recovered ${amt} HP!`);
          }
        }
      }
      if (i === 2) {
        const ok = saveGame(this.state);
        await g.say(ok ? "Game state committed. (docker commit moby moby:save)" : "Save failed: read-only filesystem?");
      }
      if (i === 3) {
        await g.say("ARROWS/WASD: move.  Z/ENTER/SPACE: A (talk, confirm).  X/ESC: B (back).");
        await g.say("TAB or M: START menu.  CTRL+C: quit.");
      }
      if (i === 5) {
        await g.say("Exiting... your progress since the last SAVE will be lost.");
        g.quit();
        return;
      }
      if (i === 4 || i < 0) return;
    }
  }

  // ---- render ----
  playerPixel() {
    const st = this.state;
    if (!this.moving) return [st.x * 8, st.y * 8];
    const t = this.moving.t;
    return [(this.moving.fx + (st.x - this.moving.fx) * t) * 8, (this.moving.fy + (st.y - this.moving.fy) * t) * 8];
  }

  drawTile(s, ch, x, y, tx, ty, time) {
    const th = this.map.theme;
    const floor = th.floorTile === "floor" ? TILES.floor : TILES.ground;
    const under = () => s.sprite(floor, x, y, { map: th.floor });
    switch (ch) {
      case ".": return under();
      case ":": return s.sprite(TILES.path, x, y, { map: th.path });
      case ",": under(); return s.sprite(TILES.grass, x, y, { map: th.grass });
      case "#": return s.sprite(TILES.wall, x, y, { map: th.wall });
      case "R": return s.sprite(TILES.rack, x, y);
      case "C": return s.sprite(TILES.container, x, y, { map: CONTAINER_COLORS[(tx * 7 + ty * 13) % 4] });
      case "~": return s.sprite(Math.floor(time / 600) % 2 ? TILES.water1 : TILES.water2, x, y);
      case "T": under(); return s.sprite(TILES.terminal, x, y);
      case "H": under(); return s.sprite(TILES.heal, x, y);
      case "S": under(); return s.sprite(TILES.sign, x, y);
      case "=": return s.sprite(TILES.firewall, x, y, { map: undefined, flip: Math.floor(time / 300) % 2 === 1 });
      case "^": return s.sprite(TILES.door, x, y);
      case "E": under(); return s.sprite(Math.floor(time / 250) % 2 ? TILES.exit1 : TILES.exit2, x, y);
      default: return under();
    }
  }

  entitySprite(e) {
    if (e.item) return [ITEMBOX, undefined];
    if (e.sprite === "gordon") return [GORDON, undefined];
    if (e.sprite?.startsWith("boss:")) return [BOSS_OW[e.sprite.slice(5)], undefined];
    return [PERSON, e.colors];
  }

  render(s, g) {
    const [ppx, ppy] = this.playerPixel();
    const camX = Math.round(ppx + 4 - 40);
    const camY = Math.round(ppy + 4 - 30);
    s.clear(PAL.k);
    const t0x = Math.floor(camX / 8) - 1;
    const t0y = Math.floor(camY / 8) - 1;
    for (let ty = t0y; ty <= t0y + 9; ty++)
      for (let tx = t0x; tx <= t0x + 11; tx++) this.drawTile(s, this.tile(tx, ty), tx * 8 - camX, ty * 8 - camY, tx, ty, g.time);

    for (const e of this.entities) {
      if (!this.visible(e)) continue;
      const [sp, map] = this.entitySprite(e);
      const bob = e.item ? Math.round(Math.sin(g.time / 300 + e.cx)) : 0;
      const ex = e.cx * 8 + e.ox - camX;
      const ey = e.cy * 8 + e.oy - camY + bob;
      s.sprite(sp, ex, ey, { map });
      if (this.emote === e) s.sprite(EMOTE, ex + 1, ey - 7);
    }

    const bob = this.moving && this.moving.t > 0.25 && this.moving.t < 0.75 ? -1 : 0;
    s.sprite(MOBY_OW, ppx - camX, ppy - camY + bob, { flip: this.lastHorizontal === "left" });

    // location banner for a moment after entering
    if (this.map.name && this.bannerUntil && g.time < this.bannerUntil) {
      const n = this.map.name;
      s.box(1, 1, n.length + 4, 3);
      s.text(3, 2, n);
    }
  }
}
