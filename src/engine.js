// Core loop helpers: input, dialog, menus, tweens, fades, scripting.
import { Screen, COLS, ROWS, W, H, PAL, TEXT_FG, TEXT_BG } from "./gfx.js";

const KEYMAP = {
  up: "up", w: "up", k: "up",
  down: "down", s: "down", j: "down",
  left: "left", a: "left", h: "left",
  right: "right", d: "right", l: "right",
  z: "a", return: "a", enter: "a", space: "a", linefeed: "a",
  x: "b", escape: "b", backspace: "b",
  tab: "start", m: "start",
};
const DIRS = new Set(["up", "down", "left", "right"]);

export class Input {
  constructor() {
    this.queue = [];
    this.held = {};
    this.sawRelease = false;
  }
  onPress(k) {
    const act = KEYMAP[k.name];
    if (!act) return;
    const now = performance.now();
    if (DIRS.has(act)) this.held[act] = now;
    if (k.eventType === "repeat" && !DIRS.has(act)) return;
    if (this.queue.length < 3) this.queue.push(act);
  }
  onRelease(k) {
    const act = KEYMAP[k.name];
    if (!act) return;
    this.sawRelease = true;
    delete this.held[act];
  }
  isHeld(dir) {
    const t = this.held[dir];
    if (t === undefined) return false;
    if (this.sawRelease) return true;
    return performance.now() - t < 110;
  }
  heldDir() {
    for (const d of ["up", "down", "left", "right"]) if (this.isHeld(d)) return d;
    return null;
  }
}

export function wrapText(text, width) {
  const lines = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      if (!line) line = word;
      else if ((line + " " + word).length <= width) line += " " + word;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function blend(a, b, t) {
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
  const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
  const bl = (a & 255) * (1 - t) + (b & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

export class Game {
  constructor() {
    this.screen = new Screen();
    this.input = new Input();
    this.time = 0;
    this.scene = null;
    this.dialog = null;
    this.menus = [];
    this.tweens = [];
    this.timers = [];
    this.fade = 0;
    this.fadeColor = PAL.k;
    this.overlays = [];
    this.busy = 0;
    this.quit = () => {};
  }

  // ---- scripting ----
  run(fn) {
    this.busy++;
    return Promise.resolve()
      .then(fn)
      .catch((e) => {
        this.lastError = e;
        this.say("ERROR: " + (e?.message ?? e));
      })
      .finally(() => this.busy--);
  }

  wait(ms) {
    return new Promise((resolve) => this.timers.push({ at: this.time + ms, resolve }));
  }

  tween(ms, fn) {
    return new Promise((resolve) => {
      fn(0);
      this.tweens.push({ start: this.time, ms, fn, resolve });
    });
  }

  async fadeOut(ms = 300, color = PAL.k) {
    this.fadeColor = color;
    await this.tween(ms, (t) => (this.fade = t));
  }
  async fadeIn(ms = 300) {
    await this.tween(ms, (t) => (this.fade = 1 - t));
  }

  // Show text in the bottom box. Resolves when dismissed.
  say(text, opts = {}) {
    const lines = wrapText(text, 74);
    const pages = [];
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
    return new Promise((resolve) => {
      this.dialog = { pages, page: 0, shown: 0, resolve, keep: opts.keep, auto: opts.auto, doneAt: null };
    });
  }

  // Static text (no typing, no wait) - used behind menus.
  prompt(text) {
    const lines = wrapText(text, 74);
    this.dialog = { pages: [lines.slice(0, 2)], page: 0, shown: 1e9, done: true, resolve() {} };
  }

  closeDialog() {
    this.dialog = null;
  }

  // Menu: items are strings. Returns index or -1 on cancel.
  menu(items, opts = {}) {
    return new Promise((resolve) => {
      const m = {
        items, index: opts.index ?? 0, resolve,
        x: opts.x ?? 60, y: opts.y ?? 0, w: opts.w, cols: opts.cols ?? 1,
        spacing: opts.spacing ?? 1, cancel: opts.cancel ?? true,
        onChange: opts.onChange, render: opts.render, disabled: opts.disabled,
      };
      if (!m.w) m.w = Math.max(...items.map((s) => s.length)) + 5;
      this.menus.push(m);
      m.onChange?.(m.index);
    });
  }

  // ---- update / input ----
  update(dt) {
    this.time += dt;
    for (const tw of [...this.tweens]) {
      const t = Math.min(1, (this.time - tw.start) / tw.ms);
      tw.fn(t);
      if (t >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.resolve();
      }
    }
    for (const tm of [...this.timers]) {
      if (this.time >= tm.at) {
        this.timers.splice(this.timers.indexOf(tm), 1);
        tm.resolve();
      }
    }
    const d = this.dialog;
    if (d) {
      const total = d.pages[d.page].join("").length;
      if (d.shown < total) d.shown = Math.min(total, d.shown + dt * 0.09);
      else if (d.auto) {
        d.doneAt ??= this.time;
        if (this.time - d.doneAt > d.auto) this.advanceDialog();
      }
    }
    while (this.input.queue.length) this.handle(this.input.queue.shift());
    this.scene?.update?.(dt);
  }

  advanceDialog() {
    const d = this.dialog;
    const total = d.pages[d.page].join("").length;
    if (d.shown < total) {
      d.shown = total;
      return;
    }
    if (d.page < d.pages.length - 1) {
      d.page++;
      d.shown = 0;
      d.doneAt = null;
      return;
    }
    if (!d.keep) this.dialog = null;
    else d.done = true;
    d.resolve();
  }

  handle(act) {
    if (this.menus.length) {
      const m = this.menus[this.menus.length - 1];
      const n = m.items.length;
      const cols = m.cols;
      let i = m.index;
      if (act === "up") i -= cols;
      if (act === "down") i += cols;
      if (act === "left" && cols > 1) i -= 1;
      if (act === "right" && cols > 1) i += 1;
      if (i >= 0 && i < n && i !== m.index) {
        m.index = i;
        m.onChange?.(i);
      }
      if (act === "a") {
        if (m.disabled?.(m.index)) return;
        this.menus.pop();
        m.resolve(m.index);
      }
      if ((act === "b" || act === "start") && m.cancel) {
        this.menus.pop();
        m.resolve(-1);
      }
      return;
    }
    if (this.dialog && !this.dialog.done) {
      if (act === "a" || act === "b") this.advanceDialog();
      return;
    }
    if (this.busy) return;
    this.scene?.onKey?.(act);
  }

  // ---- render ----
  render() {
    const s = this.screen;
    s.cells.fill(null);
    this.scene?.render?.(s, this);
    if (this.dialog) this.renderDialog(s);
    for (const m of this.menus) this.renderMenu(s, m);
    for (const o of this.overlays) o(s, this);
    if (this.fade > 0) this.applyFade(s);
  }

  renderDialog(s) {
    const d = this.dialog;
    s.box(0, 22, COLS, 8);
    let left = Math.floor(d.shown);
    const lines = d.pages[d.page];
    for (let i = 0; i < lines.length; i++) {
      const part = lines[i].slice(0, Math.max(0, left));
      left -= lines[i].length;
      s.text(3, 24 + i * 2, part);
    }
    const total = lines.join("").length;
    if (d.shown >= total && !d.auto && !d.done && Math.floor(this.time / 350) % 2 === 0) s.text(76, 28, "▼", PAL.r);
  }

  renderMenu(s, m) {
    if (m.render) return m.render(s, m);
    const rows = Math.ceil(m.items.length / m.cols);
    const colW = Math.floor((m.w - 3) / m.cols);
    const h = rows * m.spacing + (m.spacing > 1 ? 1 : 2);
    s.box(m.x, m.y, m.w, h);
    m.items.forEach((it, i) => {
      const cx = m.x + 2 + (i % m.cols) * colW;
      const cy = m.y + 1 + Math.floor(i / m.cols) * m.spacing;
      const dis = m.disabled?.(i);
      s.text(cx, cy, (i === m.index ? "▶" : " ") + it, dis ? PAL.g : TEXT_FG);
    });
  }

  applyFade(s) {
    const t = Math.min(1, this.fade);
    const c = this.fadeColor;
    for (let i = 0; i < s.px.length; i++) s.px[i] = blend(s.px[i], c, t);
    for (let i = 0; i < s.cells.length; i++) {
      const cell = s.cells[i];
      if (!cell) continue;
      s.cells[i] = { ch: cell.ch, fg: blend(cell.fg, c, t), bg: cell.bg === undefined ? undefined : blend(cell.bg, c, t) };
    }
  }
}

export { W, H, COLS, ROWS };
