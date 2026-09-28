// Renders the game screen inside a Game Boy Color-style shell.
import { Renderable } from "@opentui/core";
import { COLS, ROWS, rgba } from "./gfx.js";

const BODY = 0x5b3fa8; // "atomic purple"-ish shell
const BODY_DARK = 0x3c2878;
const BEZEL = 0x2b2f3a;
const LABEL = 0xc9c3e6;

export class GameView extends Renderable {
  constructor(ctx, game) {
    super(ctx, { width: "100%", height: "100%" });
    this.game = game;
  }

  renderSelf(buf) {
    const tw = this.width;
    const th = this.height;
    const g = this.game;
    g.render();

    const bezel = tw >= COLS + 8 && th >= ROWS + 7;
    const ox = Math.floor((tw - COLS) / 2);
    const oy = bezel ? Math.max(1, Math.floor((th - ROWS - 5) / 2)) : Math.floor((th - ROWS) / 2);

    buf.fillRect(0, 0, tw, th, rgba(0x0b0d14));
    if (tw < COLS || th < ROWS) {
      const msg = `Please resize your terminal to at least ${COLS}x${ROWS} (now ${tw}x${th}).`;
      buf.drawText(msg, Math.max(0, Math.floor((tw - msg.length) / 2)), Math.floor(th / 2), rgba(0xffd23f));
      return;
    }

    if (bezel) {
      const bx = ox - 4;
      const by = oy - 1;
      const bw = COLS + 8;
      const bh = ROWS + 5;
      buf.fillRect(bx, by, bw, bh, rgba(BODY));
      buf.fillRect(bx + 1, by + bh - 1, bw - 2, 1, rgba(BODY_DARK));
      buf.fillRect(ox - 2, oy - 1, COLS + 4, ROWS + 2, rgba(BEZEL));
      // power LED
      const led = Math.floor(g.time / 1200) % 5 ? 0xe63946 : 0x6a1c24;
      buf.drawText("●", ox - 4 + 1, oy + 3, rgba(led), rgba(BODY));
      // label
      const ly = oy + ROWS + 1;
      buf.drawText("sbx BOY ", ox, ly + 1, rgba(LABEL), rgba(BODY));
      const colors = [0xff5f5f, 0xffd23f, 0x6ee06e, 0x5fb4ff, 0xc38cff];
      [..."COLOR"].forEach((ch, i) => buf.drawText(ch, ox + 8 + i, ly + 1, rgba(colors[i]), rgba(BODY)));
      const hint = "←↑↓→ move · Z A · X B · TAB start · ^C quit";
      buf.drawText(hint, ox + COLS - hint.length, ly + 1, rgba(LABEL), rgba(BODY));
    }

    g.screen.blit(buf, ox, oy);
  }
}
