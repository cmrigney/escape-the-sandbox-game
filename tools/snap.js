// Headless driver: runs the game with simulated time and writes PNG snapshots.
// Usage: node --experimental-ffi tools/snap.js <outdir> "<script>"
// script: space-separated tokens: a b up down left right start, wN (wait N ms), snap:name
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { Game } from "../src/engine.js";
import { W, H, COLS, ROWS } from "../src/gfx.js";
import { setupGame } from "../src/story.js";

process.env.MOBY_SAVE ??= "/tmp/claude-1000/moby-test-save.json";
const [outDir, script = ""] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const FONT3 = {}; // tiny glyph approximations for text cells
function png(file, width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

function snapshot(game, name) {
  game.render();
  const s = game.screen;
  const S = 6; // image px per game px (cell = 6x12)
  const iw = W * S, ih = H * S;
  const rgb = Buffer.alloc(iw * ih * 3);
  const put = (x, y, c) => { const o = (y * iw + x) * 3; rgb[o] = (c >> 16) & 255; rgb[o + 1] = (c >> 8) & 255; rgb[o + 2] = c & 255; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = s.px[y * W + x];
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) put(x * S + i, y * S + j, c);
  }
  let txt = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = s.cells[r * COLS + c];
      if (!cell) { txt += "·"; continue; }
      txt += cell.ch;
      const bg = cell.bg ?? s.px[r * 2 * W + c];
      for (let j = 0; j < S * 2; j++) for (let i = 0; i < S; i++) put(c * S + i, r * S * 2 + j, bg);
      if (cell.ch !== " ") for (let j = 3; j < S * 2 - 2; j++) for (let i = 1; i < S - 1; i++) if ((i + j) % 2 === 0 || /[━┃┏┓┗┛█▌─│]/.test(cell.ch)) put(c * S + i, r * S * 2 + j, cell.fg);
    }
    txt += "\n";
  }
  png(path.join(outDir, name + ".png"), iw, ih, rgb);
  fs.writeFileSync(path.join(outDir, name + ".txt"), txt);
}

const game = new Game();
game.quit = () => {};
setupGame(game);
const step = (ms) => { for (let t = 0; t < ms; t += 33) game.update(33); };
const flush = () => new Promise((r) => setImmediate(r));
for (const tok of script.split(/\s+/).filter(Boolean)) {
  if (tok.startsWith("w")) { const n = +tok.slice(1); for (let t = 0; t < n; t += 33) { game.update(33); await flush(); } continue; }
  if (tok.startsWith("snap:")) { snapshot(game, tok.slice(5)); continue; }
  if (tok.startsWith("hold:")) { // hold:dir:ms
    const [, d, ms] = tok.split(":");
    for (let t = 0; t < +ms; t += 33) { game.input.held[d] = performance.now(); game.update(33); await flush(); }
    delete game.input.held[d]; continue;
  }
  if (tok.startsWith("auto:")) { // mash A for N ms, logging dialog pages
    let lastTxt = "";
    for (let t = 0; t < +tok.slice(5); t += 33) {
      game.update(33); await flush();
      const d = game.dialog;
      const txt = d ? d.pages[d.page].join(" ") : "";
      if (txt && txt !== lastTxt) { console.log("  |", txt); lastTxt = txt; }
      if (t % 165 === 0) game.input.queue.push("a");
    }
    continue;
  }
  if (tok.startsWith("eval:")) { eval(tok.slice(5)); continue; }
  game.input.queue.push(tok);
  for (let i = 0; i < 4; i++) { game.update(33); await flush(); }
}
if (game.lastError) console.error("GAME ERROR:", game.lastError);
console.log("state:", JSON.stringify({ map: game.state.map, x: game.state.x, y: game.state.y, lvl: game.state.moby.level, hp: game.state.moby.hp }));
