#!/usr/bin/env node
// Launcher: checks the Node version before loading OpenTUI's native FFI bindings.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 26 || (major === 26 && minor < 4)) {
  console.error(`MOBY: ESCAPE THE SANDBOX needs Node.js >= 26.4 (OpenTUI's Node runtime). You have ${process.version}.`);
  process.exit(1);
}
if (!process.execArgv.includes("--experimental-ffi")) {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const main = fileURLToPath(new URL("../src/main.js", import.meta.url));
  const r = spawnSync(process.execPath, ["--experimental-ffi", "--no-warnings", main, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(r.status ?? 0);
}
await import("../src/main.js");
