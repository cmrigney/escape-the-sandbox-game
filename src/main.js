// MOBY: ESCAPE THE SANDBOX - entry point.
import { createCliRenderer } from "@opentui/core";
import { Game } from "./engine.js";
import { setupGame } from "./story.js";
import { GameView } from "./view.js";

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 30,
  useKittyKeyboard: { events: true },
  backgroundColor: "#0b0d14",
});

const game = new Game();
game.quit = () => {
  renderer.destroy();
  process.exit(0);
};
setupGame(game);

const view = new GameView(renderer, game);
renderer.root.add(view);

renderer.keyInput.on("keypress", (k) => {
  if (k.ctrl && k.name === "c") return;
  game.input.onPress(k);
});
renderer.keyInput.on("keyrelease", (k) => game.input.onRelease(k));

let last = performance.now();
renderer.setFrameCallback(async () => {
  const now = performance.now();
  const dt = Math.min(100, now - last);
  last = now;
  game.update(dt);
});
renderer.start();
