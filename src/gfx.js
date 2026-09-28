// Pixel + cell renderer. The "LCD" is 80x60 pixels, drawn with half-block
// characters into 80x30 terminal cells. A text layer sits on top of it.
import { RGBA } from "@opentui/core";

export const W = 80;
export const H = 60;
export const COLS = 80;
export const ROWS = 30;

// Game Boy Color-ish palette. Single chars are used in sprite art.
export const PAL = {
  k: 0x0b1320, // near black
  K: 0x2b3240, // dark gray
  g: 0x6b7686, // gray
  G: 0xaab4c0, // light gray
  w: 0xf6f8f2, // white
  W: 0xdfe8d8, // off white
  b: 0x1d63ed, // docker blue
  B: 0x0b3b8f, // navy
  l: 0x86bdff, // light blue
  c: 0x2de2e6, // cyan
  C: 0x138a9a, // teal
  n: 0x4caf50, // green
  N: 0x1e6b37, // dark green
  m: 0xa8e063, // lime
  y: 0xffd23f, // yellow
  o: 0xff8c2a, // orange
  r: 0xe63946, // red
  R: 0x8a1c2b, // dark red
  p: 0x9b5de5, // purple
  P: 0x4f2587, // dark purple
  u: 0x9a6232, // brown
  U: 0x5c3717, // dark brown
  s: 0xffcf9e, // skin
  e: 0xff5fa2, // pink
  t: 0xd9c38c, // sand
};

export const TEXT_FG = 0x0b1320;
export const TEXT_BG = 0xf6f8f2;

const rgbaCache = new Map();
export function rgba(n) {
  let v = rgbaCache.get(n);
  if (!v) {
    v = RGBA.fromInts((n >> 16) & 255, (n >> 8) & 255, n & 255, 255);
    rgbaCache.set(n, v);
  }
  return v;
}

// Parse sprite art (array of strings) once into a compact form.
export function spr(rows) {
  const w = Math.max(...rows.map((r) => r.length));
  return { w, h: rows.length, rows: rows.map((r) => r.padEnd(w, ".")) };
}

export class Screen {
  constructor() {
    this.px = new Int32Array(W * H);
    this.cells = new Array(COLS * ROWS).fill(null);
    this.shakeX = 0;
  }

  clear(c = PAL.w) {
    this.px.fill(c);
    this.cells.fill(null);
  }

  pset(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.px[y * W + x] = c;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.pset(x + i, y + j, c);
  }

  ellipse(cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++)
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.pset(cx + x, cy + y, c);
  }

  // Draw sprite. opts.map remaps chars to colors, opts.flip mirrors,
  // opts.solid paints every opaque pixel one color, opts.clipBottom hides rows below y.
  sprite(s, x, y, opts = {}) {
    const { map, flip, solid, clipBottom } = opts;
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < s.h; j++) {
      if (clipBottom !== undefined && y + j >= clipBottom) break;
      const row = s.rows[j];
      for (let i = 0; i < s.w; i++) {
        const ch = row[flip ? s.w - 1 - i : i];
        if (ch === "." || ch === " ") continue;
        let c = solid ?? map?.[ch] ?? PAL[ch];
        if (c === undefined) continue;
        this.pset(x + i, y + j, c);
      }
    }
  }

  // --- cell layer ---
  cell(col, row, ch, fg, bg) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return;
    this.cells[row * COLS + col] = { ch, fg, bg };
  }

  text(col, row, str, fg = TEXT_FG, bg = TEXT_BG) {
    let i = 0;
    for (const ch of str) this.cell(col + i++, row, ch, fg, bg);
  }

  fillCells(col, row, w, h, bg = TEXT_BG) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.cell(col + i, row + j, " ", TEXT_FG, bg);
  }

  // Thick GB-style text box.
  box(col, row, w, h, { fg = 0x1b2a4a, bg = TEXT_BG } = {}) {
    this.fillCells(col, row, w, h, bg);
    for (let i = 1; i < w - 1; i++) {
      this.cell(col + i, row, "━", fg, bg);
      this.cell(col + i, row + h - 1, "━", fg, bg);
    }
    for (let j = 1; j < h - 1; j++) {
      this.cell(col, row + j, "┃", fg, bg);
      this.cell(col + w - 1, row + j, "┃", fg, bg);
    }
    this.cell(col, row, "┏", fg, bg);
    this.cell(col + w - 1, row, "┓", fg, bg);
    this.cell(col, row + h - 1, "┗", fg, bg);
    this.cell(col + w - 1, row + h - 1, "┛", fg, bg);
  }

  // Composite into an OpenTUI OptimizedBuffer at (ox, oy).
  blit(buf, ox, oy) {
    const sx = this.shakeX | 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r * COLS + c];
        if (cell) {
          const bg = cell.bg ?? this.px[r * 2 * W + c];
          buf.setCell(ox + c, oy + r, cell.ch, rgba(cell.fg), rgba(bg));
          continue;
        }
        const pc = Math.min(W - 1, Math.max(0, c - sx));
        const top = this.px[r * 2 * W + pc];
        const bot = this.px[(r * 2 + 1) * W + pc];
        if (top === bot) buf.setCell(ox + c, oy + r, " ", rgba(top), rgba(bot));
        else buf.setCell(ox + c, oy + r, "▀", rgba(top), rgba(bot));
      }
    }
  }
}

// Tiny 3x5 pixel font for titles.
const FONT = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"], D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"], J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."], P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"], V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
  "?": ["##.", "..#", ".#.", "...", ".#."], "!": [".#.", ".#.", ".#.", "...", ".#."],
  ".": ["...", "...", "...", "...", ".#."], " ": ["...", "...", "...", "...", "..."],
};

export function textWidth(str, scale = 1) {
  return str.length * 4 * scale - scale;
}

export function pixelText(screen, str, x, y, color, scale = 1) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch] ?? FONT["?"];
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 3; i++)
        if (g[j][i] === "#") screen.rect(cx + i * scale, y + j * scale, scale, scale, color);
    cx += 4 * scale;
  }
}

// 5x7 font for the big logo.
const BIG = {
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
};

export function bigTextWidth(str, scale) {
  return str.length * 6 * scale - scale;
}

export function bigText(screen, str, x, y, color, scale = 2) {
  let cx = x;
  for (const ch of str) {
    const g = BIG[ch];
    if (g) for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j][i] === "#") screen.rect(cx + i * scale, y + j * scale, scale, scale, color);
    cx += 6 * scale;
  }
}
