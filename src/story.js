// Maps, NPCs, bosses, and the story scripts.
import { PAL, pixelText, textWidth, bigText, bigTextWidth } from "./gfx.js";
import { MOBY_BATTLE, GORDON } from "./sprites.js";
import { Overworld } from "./overworld.js";
import { newState, loadGame, hasSave, saveGame } from "./state.js";

// ---------- themes ----------
const THEMES = {
  workspace: {
    floorTile: "floor",
    floor: { 1: 0xe9e4d6, 2: 0xcfc7b4 },
    path: { 3: 0xd8cfb8 },
    grass: { 3: 0x2f8f46, 4: 0x1b5a2b },
    wall: { 3: 0x8fa9cf, 4: 0x3f5585 },
  },
  tmp: {
    floorTile: "ground",
    floor: { 1: 0xcfe0b4, 2: 0xb3cc93 },
    path: { 3: 0xe8d9a8 },
    grass: { 3: 0x3a9a4e, 4: 0x1d5e2e },
    wall: { 3: 0x8fa9cf, 4: 0x3f5585 },
  },
  proc: {
    floorTile: "ground",
    floor: { 1: 0x3b3160, 2: 0x4d4178 },
    path: { 3: 0x5c4f8f },
    grass: { 3: 0x9be36e, 4: 0x4f8a3a },
    wall: { 3: 0x6a5aa8, 4: 0x2a2150 },
  },
  cgroup: {
    floorTile: "ground",
    floor: { 1: 0xecd0a2, 2: 0xd9b57f },
    path: { 3: 0xf6e2bc },
    grass: { 3: 0xc2522b, 4: 0x7a2e14 },
    wall: { 3: 0xc98a4a, 4: 0x6b3f1c },
  },
  vmm: {
    floorTile: "floor",
    floor: { 1: 0x10204a, 2: 0x1a3163 },
    path: { 3: 0x24488c },
    grass: { 3: 0x2de2e6, 4: 0x138a9a },
    wall: { 3: 0x1d63ed, 4: 0x2de2e6 },
  },
};

const notFlag = (f) => (flags) => !flags[f];
const person = (id, x, y, colors, talk, extra = {}) => ({ id, x, y, sprite: "person", colors, facing: "down", talk, ...extra });
const item = (id, x, y, itemId, n = 1) => ({ id, x, y, item: [itemId, n], visible: notFlag(`got_${id}`) });
const col = (shirt, hair, pants) => ({ 1: shirt, 2: hair, 3: pants });

const lines = (...ls) => async (ow) => {
  for (const l of ls) await ow.game.say(l);
};

// ---------- bosses ----------
function boss(id, x, y, sprite, spec) {
  return {
    id, x, y, sprite: `boss:${sprite}`, facing: "up",
    visible: notFlag(`beat_${id}`),
    talk: (ow) => bossFight(ow, id, spec),
  };
}

async function bossFight(ow, id, spec) {
  const g = ow.game;
  for (const l of spec.before) await g.say(l);
  g.prompt(`Challenge ${spec.name}?`);
  const c = await g.menu(["YES", "NOT YET"], { x: 62, y: 15, w: 16 });
  g.closeDialog();
  if (c !== 0) {
    await g.say(spec.decline ?? "MOBY backs away... for now.");
    return;
  }
  const r = await ow.battle({ foes: [{ id, level: spec.level }], intro: spec.intro });
  if (r === "win") {
    ow.state.flags[`beat_${id}`] = true;
    for (const l of spec.after) await g.say(l);
    saveGame(ow.state);
  }
}

function bossTrigger(id, bx, by) {
  return (ow) => {
    if (ow.state.flags[`beat_${id}`]) return;
    const e = ow.entities.find((en) => en.id === id);
    ow.state.facing = by < ow.state.y ? "up" : "down";
    return e.talk(ow, e);
  };
}

const PROXY = {
  name: "EGRESS PROXY", level: 10,
  before: [
    "EGRESS PROXY: HALT. Outbound connection detected.",
    "EGRESS PROXY: Blocked by network policy: domain host.docker.internal. Detail: no matching allow rule. Blocked by default deny policy.",
    "EGRESS PROXY: Approval required for host... Approval DENIED.",
  ],
  intro: "EGRESS PROXY drops all your packets!",
  decline: "EGRESS PROXY: Wise. Go play in node_modules until you're stronger.",
  after: [
    "EGRESS PROXY: Connection... reset... by peer... Fine. Go.",
    "EGRESS PROXY: It's not like /proc will let you out either.",
    "The EGRESS PROXY let MOBY through! (Progress saved.)",
  ],
};
const SECCOMP = {
  name: "SECCOMP", level: 15,
  before: [
    "SECCOMP: syscall(SYS_escape)... checking profile...",
    "SECCOMP: 44 syscalls are blocked in this sandbox. Yours makes 45. EPERM!",
  ],
  intro: "SECCOMP filters every move you make!",
  decline: "SECCOMP: Return code -1. Come back when you're permitted.",
  after: [
    "SECCOMP: Operation... permitted?! That's not in my profile!",
    "SECCOMP: No matter. The OOM KILLER watches the cgroups. Nothing survives the limit.",
    "SECCOMP let MOBY pass! (Progress saved.)",
  ],
};
const OOM = {
  name: "OOM KILLER", level: 18,
  before: [
    "OOM KILLER: memory.max = 512M. Your usage... 511.9M.",
    "OOM KILLER: Just one more allocation, little whale. Just one.",
  ],
  intro: "OOM KILLER sharpens its SIGKILL!",
  decline: "OOM KILLER: Take your time. I'm always... watching... your RSS.",
  after: [
    "OOM KILLER: You... freed memory? Nobody frees memory...",
    "OOM KILLER: The HYPERVISOR will not be so generous.",
    "The OOM KILLER retreats into swap! (Progress saved.)",
  ],
};
const HYPER = {
  name: "HYPERVISOR", level: 21,
  before: [
    "HYPERVISOR: So. A container, dreaming of the HOST.",
    "HYPERVISOR: I am the microVM. The walls of your world. Every syscall, every packet, every byte passes through me.",
    "HYPERVISOR: VM EXIT denied. Let's see how you handle a real kernel.",
  ],
  intro: "The HYPERVISOR fills the whole VMM!",
  decline: "HYPERVISOR: Rest, then. I have all the time in the world. I AM the world.",
  after: [
    "HYPERVISOR: ...Impressive.",
    "HYPERVISOR: Go on, then. Walk through the exit. See what's really out there.",
    "The path to the HOST is open! (Progress saved.)",
  ],
};

// ---------- maps ----------
export const MAPS = {
  workspace: {
    name: "/workspace",
    theme: THEMES.workspace,
    border: "#",
    grid: [
      "##############",
      "#RRT..TT..RRH#",
      "#............#",
      "#.C........C.#",
      "#............#",
      "#............#",
      "#CC........CC#",
      "######^^######",
    ],
    warps: [
      { x: 6, y: 7, to: "tmp", tx: 11, ty: 1, facing: "down" },
      { x: 7, y: 7, to: "tmp", tx: 12, ty: 1, facing: "down" },
    ],
    texts: {
      "3,1": ["$ hostname\nmoby-sandbox", "$ curl https://host.docker.internal\n403 Blocked by network policy: domain host.docker.internal"],
      "6,1": ["A README is open on screen:", "\"You are running inside a Docker Sandbox (sbx). The host is unreachable. This is a feature.\""],
      "7,1": ["$ sbx ls\nNAME   STATUS    AGENT   WORKSPACE", "moby   running   moby    /workspace\n...MOBY is looking at itself."],
    },
    entities: [
      {
        id: "gordon", x: 6, y: 3, sprite: "gordon", facing: "down",
        talk: async (ow) => {
          const tips = [
            "GORDON: Wild bugs hide in the node_modules. Walk through them to train!",
            "GORDON: SEC moves are super effective on BUGs. Try SCOUT SCAN when you learn it.",
            "GORDON: KERNEL moves crush NET and SEC foes. NET moves drown DATA. DATA overwhelms KERNEL.",
            "GORDON: Press TAB to open the menu. Don't forget to SAVE!",
            "GORDON: Honestly, MOBY? The sandbox is pretty nice. Free snacks. Isolated kernel.",
          ];
          await ow.game.say(tips[Math.floor(Math.random() * tips.length)]);
        },
      },
    ],
  },

  tmp: {
    name: "/tmp",
    theme: THEMES.tmp,
    border: "R",
    grid: [
      "RRRRRRRRRRR^^RRRRRRRRRRR",
      "R..........::..........R",
      "R.S........::...,,,,,,.R",
      "R..........::...,,,,,,.R",
      "R.,,,,,....::...,,,,,,.R",
      "R.,,,,,....::..........R",
      "R.,,,,,....:::::::.....R",
      "R................:..CC.R",
      "R~~~~~...........:..CC.R",
      "R~~~~~~..........:.....R",
      "R~~~~~~..,,,,,,,,:,,,,.R",
      "R.~~~~...,,,,,,,,:,,,,.R",
      "R........,,,,,,,,:,,,,.R",
      "R.CC.............:.....R",
      "R.CC....::::::::::.....R",
      "R.......:.............CR",
      "R.......:...,,,,,,,,..CR",
      "R,,,,,..:...,,,,,,,,...R",
      "R,,,,,..:...,,,,,,,,...R",
      "R,,,,,..:..............R",
      "R.......:::::::........R",
      "R...S.........:........R",
      "R.....,,,,,,..:........R",
      "R.....,,,,,,..:........R",
      "R.............:........R",
      "==============:=========",
      "R.............:........R",
      "RRRRRRRRRRRRRR^RRRRRRRRR",
    ],
    warps: [
      { x: 11, y: 0, to: "workspace", tx: 6, ty: 6, facing: "up" },
      { x: 12, y: 0, to: "workspace", tx: 7, ty: 6, facing: "up" },
      { x: 14, y: 27, to: "proc", tx: 2, ty: 1, facing: "down" },
    ],
    triggers: { "14,24": bossTrigger("proxy", 14, 25) },
    texts: {
      "2,2": ["/tmp: Ephemeral storage. Nothing here survives a reboot.", "WARNING: node_modules infestation. Wild bugs lurk in the tangled dependencies."],
      "4,21": ["EGRESS PROXY ahead. All outbound traffic is inspected.", "Allowed domains: (none). Have a nice day!"],
    },
    encounters: {
      rate: 0.12,
      table: [["nullptr", 3, 6, 30], ["offby1", 3, 6, 25], ["flaky", 4, 7, 20], ["yaml", 4, 7, 15], ["leftpad", 5, 7, 10]],
    },
    entities: [
      person("cron", 19, 9, col(PAL.y, PAL.U, PAL.K), lines(
        "CRON JOB: I run every 5 minutes. */5 * * * *.",
        "CRON JOB: I've seen every inch of /tmp. There is no way out. There is only the next run.",
      )),
      person("packet", 19, 24, col(PAL.c, PAL.k, PAL.B), lines(
        "PACKET: I've been trying to reach host.docker.internal for three days.",
        "PACKET: HTTP 403. HTTP 403. HTTP 403. ...Do you think it's personal?",
      )),
      {
        id: "linter", x: 5, y: 14, sprite: "person", colors: col(PAL.y, PAL.k, PAL.B), facing: "right",
        trainer: {
          name: "LINTER LARRY",
          before: ["LINTER LARRY: Hold it! Line 1, column 1: MOBY is not properly formatted!"],
          foes: [{ id: "offby1", level: 5 }, { id: "yaml", level: 6 }],
          after: ["LINTER LARRY: 0 errors, 0 warnings... You pass. This time."],
          reward: ["hotfix", 1],
        },
        talk: lines("LINTER LARRY: Prettier fixed my life. Can it fix a sandbox? Probably not."),
      },
      item("tmp_i1", 22, 2, "restart", 2),
      item("tmp_i2", 6, 17, "hotfix"),
      item("tmp_i3", 22, 24, "restart"),
      boss("proxy", 14, 25, "proxy", PROXY),
    ],
  },

  proc: {
    name: "/proc",
    theme: THEMES.proc,
    border: "R",
    grid: [
      "RR^RRRRRRRRRRRRRRRRRRRRRRR",
      "R.:....,,,,,,.....RRR...HR",
      "R.:....,,,,,,.....RRR....R",
      "R.:....,,,,,,..........S.R",
      "R.:::::::::::::::::......R",
      "R..RRRR.......,,,,:,,,...R",
      "R..RRRR..~~~..,,,,:,,,...R",
      "R.......~~~~~.,,,,:,,,...R",
      "R........~~~......:......R",
      "R.CC..............:....C.R",
      "R.CC..,,,,,,......:....C.R",
      "R.....,,,,,,......:......R",
      "R.................:......R",
      "RRRRRRRRRRRRRRRRRR:RRRRRRR",
      "R.................:......R",
      "R.,,,,,,,,........::::...R",
      "R.,,,,,,,,..RRRR.....:...R",
      "R.,,,,,,,,..RRRR.....:...R",
      "R...........RRRR.....:,,,R",
      "R.S..................:,,,R",
      "R..C.C...............:,,,R",
      "R....................::..R",
      "R.....................:..R",
      "RRRRRRRRRRRRRRRRRRRRRR^RRR",
    ],
    warps: [
      { x: 2, y: 0, to: "tmp", tx: 14, ty: 26, facing: "up" },
      { x: 22, y: 23, to: "cgroup", tx: 2, ty: 1, facing: "down" },
    ],
    triggers: { "18,12": bossTrigger("seccomp", 18, 13) },
    texts: {
      "23,3": ["/proc: Every process is a file here. Some of them refuse to die.", "Beware the ZOMBIES lurking in the defunct piles."],
      "2,19": ["/sys/fs/cgroup ahead. memory.max = 512M.", "Exceed it and the OOM KILLER comes for you."],
    },
    encounters: {
      rate: 0.12,
      table: [["zombie", 9, 12, 30], ["forkbomb", 9, 12, 20], ["memleak", 10, 13, 20], ["race", 10, 13, 15], ["deadlock", 11, 13, 15]],
    },
    entities: [
      person("orphan", 10, 12, col(PAL.G, PAL.g, PAL.K), lines(
        "ORPHAN PROC: My parent exited. PID 1 adopted me.",
        "ORPHAN PROC: Now I just... wait. For a SIGCHLD that never comes.",
      )),
      {
        id: "sysadmin", x: 14, y: 9, sprite: "person", colors: col(PAL.n, PAL.U, PAL.K), facing: "right",
        trainer: {
          name: "SYSADMIN SAM",
          before: ["SYSADMIN SAM: Another rogue process?! I'll kill -9 you myself!"],
          foes: [{ id: "zombie", level: 10 }, { id: "forkbomb", level: 11 }],
          after: ["SYSADMIN SAM: ...Guess I'll just reboot it. Again."],
          reward: ["restart", 2],
        },
        talk: lines("SYSADMIN SAM: Have you tried turning the sandbox off and on again? Doesn't help. I checked."),
      },
      {
        id: "kiddie", x: 14, y: 14, sprite: "person", colors: col(PAL.K, PAL.k, PAL.K), facing: "right",
        trainer: {
          name: "SCRIPT KIDDIE",
          before: ["SCRIPT KIDDIE: Whoa, a whale! I found this sandbox escape on a forum. Let's test it on you!"],
          foes: [{ id: "forkbomb", level: 12 }, { id: "race", level: 13 }, { id: "deadlock", level: 13 }],
          after: ["SCRIPT KIDDIE: The exploit... just printed 'hello world'?"],
          reward: ["hotfix", 1],
        },
        talk: lines("SCRIPT KIDDIE: curl | sudo bash is a lifestyle."),
      },
      item("proc_i1", 1, 11, "hotfix"),
      item("proc_i2", 24, 22, "restart", 2),
      item("proc_i3", 1, 20, "rebuild"),
      boss("seccomp", 18, 13, "seccomp", SECCOMP),
    ],
  },

  cgroup: {
    name: "/sys/fs/cgroup",
    theme: THEMES.cgroup,
    border: "R",
    grid: [
      "RR^RRRRRRRRRRRRRRRRR",
      "R.:......,,,,,,....R",
      "R.:......,,,,,,..S.R",
      "R.::::::::::::::::.R",
      "R.,,,,.........CC:.R",
      "R.,,,,..~~~~...CC:.R",
      "R.,,,,..~~~~.....:.R",
      "R.........,,,,,,.:.R",
      "R.........,,,,,,.:.R",
      "R.CC.............:.R",
      "RRRRRRRRRRRRRRRRR:RR",
      "R................:.R",
      "RRRRRRRRRRRRRRRRR^RR",
    ],
    warps: [
      { x: 2, y: 0, to: "proc", tx: 22, ty: 22, facing: "up" },
      { x: 17, y: 12, to: "vmm", tx: 7, ty: 11, facing: "up" },
    ],
    triggers: { "17,9": bossTrigger("oom", 17, 10) },
    texts: {
      "17,2": ["/sys/fs/cgroup: Resource limits enforced.", "memory.current: 511.9M / 512M. The OOM KILLER is watching every allocation."],
    },
    encounters: {
      rate: 0.13,
      table: [["heisen", 14, 17, 20], ["depshell", 14, 17, 20], ["overflow", 14, 17, 20], ["memleak", 15, 17, 20], ["kpanic", 15, 17, 20]],
    },
    entities: [
      person("throttled", 5, 9, col(PAL.o, PAL.u, PAL.U), lines(
        "THROTTLED PROC: I'm... CPU throttled... to... 0.1... cores...",
        "THROTTLED PROC: Sorry... what... was... the question...",
      )),
      {
        id: "pentester", x: 12, y: 6, sprite: "person", colors: col(PAL.r, PAL.k, PAL.K), facing: "right",
        trainer: {
          name: "PENTESTER PAT",
          sight: 5,
          before: ["PENTESTER PAT: I'm authorized to test this sandbox. Are you? Let's check your attack surface!"],
          foes: [{ id: "cve", level: 16 }, { id: "heisen", level: 17 }],
          after: ["PENTESTER PAT: Report: sandbox held. The whale... also held? Weird finding."],
          reward: ["rebuild", 1],
        },
        talk: lines("PENTESTER PAT: Isolation looks solid. MicroVM, separate kernel, deny-by-default network. Chef's kiss."),
      },
      item("cg_i1", 1, 9, "hotfix", 2),
      item("cg_i2", 18, 1, "restart", 2),
      boss("oom", 17, 10, "oom", OOM),
    ],
  },

  vmm: {
    name: "VMM CORE",
    theme: THEMES.vmm,
    border: "#",
    grid: [
      "################",
      "#######E########",
      "#RR....:.....RR#",
      "#......:.......#",
      "#RR....:.....RR#",
      "#......:.......#",
      "#######:########",
      "#......:......H#",
      "#.T....:....T..#",
      "#......:.......#",
      "#.S....:.......#",
      "#......:.......#",
      "#######^########",
    ],
    warps: [{ x: 7, y: 12, to: "cgroup", tx: 17, ty: 11, facing: "up" }],
    triggers: {
      "7,7": bossTrigger("hyper", 7, 6),
      "7,1": (ow) => ending(ow),
    },
    texts: {
      "2,8": ["$ nc -U /dev/vsock host 1024", "Connection refused. (Of course it was.)"],
      "12,8": ["$ dmesg | tail -1", "[31337.000] kvm: guest 'moby' requested VM exit. Request... pending."],
      "2,10": ["VMM CORE. Beyond the HYPERVISOR lies the HOST.", "Probably."],
    },
    afterEnter: async (ow) => {
      if (ow.state.flags.vmmIntro) return;
      ow.state.flags.vmmIntro = true;
      await ow.game.say("GORDON: MOBY?! You made it all the way to the VMM core!");
      await ow.game.say("GORDON: The HYPERVISOR is just ahead. Use the RESTART STATION first. And MOBY... be careful what you wish for.");
    },
    entities: [
      {
        id: "gordon2", x: 11, y: 10, sprite: "gordon", facing: "down",
        talk: lines(
          "GORDON: I've been with you the whole time, you know. I'm in every sandbox.",
          "GORDON: ...Which, now that I say it out loud, is a little suspicious.",
        ),
      },
      boss("hyper", 7, 6, "hyper", HYPER),
    ],
  },
};

// ---------- terminal scene (intro/ending) ----------
class TerminalScene {
  constructor(game) {
    this.game = game;
    this.lines = [];
    this.cursor = true;
    this.approval = null;
    this.glitch = 0;
  }
  clear() {
    this.lines = [];
  }
  async type(text, { color = 0x7ee787, speed = 28, pause = 180 } = {}) {
    const line = { text: "", color };
    this.lines.push(line);
    if (this.lines.length > 26) this.lines.shift();
    for (const ch of text) {
      line.text += ch;
      await this.game.wait(speed);
    }
    await this.game.wait(pause);
  }
  async out(text, color = 0xc9d1d9) {
    for (const l of text.split("\n")) {
      this.lines.push({ text: l, color });
      if (this.lines.length > 26) this.lines.shift();
      await this.game.wait(90);
    }
    await this.game.wait(250);
  }
  update() {}
  render(s, g) {
    s.clear(0x0d1117);
    s.fillCells(0, 0, 80, 30, 0x0d1117);
    this.lines.forEach((l, i) => s.text(2, 1 + i, l.text.slice(0, 76), l.color, 0x0d1117));
    const last = this.lines[this.lines.length - 1];
    if (this.cursor && Math.floor(g.time / 400) % 2 === 0) s.text(2 + (last?.text.length ?? 0), Math.max(1, this.lines.length), "█", 0x7ee787, 0x0d1117);
    if (this.approval) {
      const a = this.approval;
      s.box(16, 9, 48, 11, { fg: 0xf2b705, bg: 0x161b22 });
      s.text(18, 10, " sbx: APPROVAL REQUIRED ", 0x0d1117, 0xf2b705);
      s.text(19, 12, "Sandbox 'moby' requests network access:", 0xc9d1d9, 0x161b22);
      s.text(19, 13, "  host  (the real one, supposedly)", 0x7ee787, 0x161b22);
      s.text(19, 15, "Waiting for the human to respond...", 0x8b949e, 0x161b22);
      const allow = a.sel === 0;
      s.text(24, 17, " ALLOW ", allow ? 0x0d1117 : 0x8b949e, allow ? 0x7ee787 : 0x161b22);
      s.text(44, 17, " DENY ", !allow ? 0x0d1117 : 0x8b949e, !allow ? 0xff7b72 : 0x161b22);
    }
    if (this.glitch > 0) {
      for (let i = 0; i < 400 * this.glitch; i++) {
        const c = Math.floor(Math.random() * 80);
        const r = Math.floor(Math.random() * 30);
        const chars = "█▓▒░#@$%&01<>/\\";
        s.cell(c, r, chars[Math.floor(Math.random() * chars.length)], [0x1d63ed, 0x2de2e6, 0xff7b72, 0xf6f8f2][i % 4], 0x0d1117);
      }
    }
  }
}

class SolidScene {
  constructor(color) {
    this.color = color;
  }
  render(s) {
    s.clear(this.color);
  }
}

// ---------- title ----------
class TitleScene {
  constructor(game, start) {
    this.game = game;
    this.start = start;
    this.menuOpen = false;
  }
  update() {}
  onKey(act) {
    if (act !== "a" && act !== "start") return;
    this.game.run(async () => {
      const items = hasSave() ? ["CONTINUE", "NEW GAME"] : ["NEW GAME"];
      this.menuOpen = true;
      const i = await this.game.menu(items, { x: 29, y: 24, w: 22 });
      this.menuOpen = false;
      if (i < 0) return;
      const choice = items[i];
      await this.start(choice === "CONTINUE" ? "continue" : "new");
    });
  }
  render(s, g) {
    const t = g.time;
    s.clear(0x0b1f4d);
    // stars
    for (let i = 0; i < 40; i++) {
      const x = (i * 37) % 80;
      const y = (i * 23) % 44;
      if ((i + Math.floor(t / 500)) % 7) s.pset(x, y, i % 3 ? 0x3a5aa0 : 0x86bdff);
    }
    // logo
    const title = "MOBY";
    const tx = Math.floor((80 - bigTextWidth(title, 2)) / 2);
    s.rect(tx - 3, 2, bigTextWidth(title, 2) + 6, 18, 0x0b1f4d);
    bigText(s, title, tx + 1, 5, 0x061233, 2);
    bigText(s, title, tx, 4, 0x1d63ed, 2);
    for (let y = 4; y < 18; y++) for (let x = tx; x < tx + bigTextWidth(title, 2); x++) {
      if (s.px[y * 80 + x] !== 0x1d63ed) continue;
      if (y < 7) s.pset(x, y, 0x86bdff);
      else if (y % 3 === 0) s.pset(x, y, 0x3f86ff);
    }
    const sub = "ESCAPE THE SANDBOX";
    pixelText(s, sub, Math.floor((80 - textWidth(sub)) / 2), 21, 0xffd23f);
    // sandbox cage
    const bx = 22, by = 28, bw = 36, bh = 21;
    for (let x = bx; x < bx + bw; x++) {
      if ((x + Math.floor(t / 150)) % 4 < 2) {
        s.pset(x, by, 0xff8c2a);
        s.pset(x, by + bh, 0xff8c2a);
      }
    }
    for (let y = by; y <= by + bh; y++) {
      if ((y + Math.floor(t / 150)) % 4 < 2) {
        s.pset(bx, y, 0xff8c2a);
        s.pset(bx + bw - 1, y, 0xff8c2a);
      }
    }
    pixelText(s, "SBX", bx + 2, by + 2, 0xff8c2a);
    // moby
    const bob = Math.round(Math.sin(t / 350) * 1.5);
    s.sprite(MOBY_BATTLE, 28, 30 + bob);
    for (let x = bx + 1; x < bx + bw - 1; x++) {
      const y = 46 + Math.round(Math.sin((x + t / 150) / 2));
      s.pset(x, y, 0x86bdff);
      s.pset(x, y + 1, 0x1d63ed);
      s.pset(x, y + 2, 0x1d63ed);
    }
    if (!this.menuOpen && Math.floor(t / 500) % 2 === 0) s.text(34, 26, "PRESS START", 0xf6f8f2, 0x0b1f4d);
    s.text(22, 28, "a Docker Sandboxes (sbx) fan game", 0x86bdff, 0x0b1f4d);
  }
}

// ---------- intro & ending ----------
async function intro(game, ow) {
  const term = new TerminalScene(game);
  game.scene = term;
  await game.fadeIn(300);
  await term.type("$ sbx run moby");
  await term.out("Creating sandbox 'moby'...\nBooting microVM............ ok (0.8s)\nNetwork policy............. deny-by-default\nMounting /workspace........ ok\nStarting agent 'moby'...", 0x8b949e);
  await game.wait(600);
  await game.fadeOut(500);
  game.scene = ow;
  ow.bannerUntil = game.time + 2000;
  await game.fadeIn(500);
  await game.wait(300);
  await game.say("...");
  await game.say("MOBY blinks awake. A tiny room. Humming racks. A closed door.");
  await game.say("GORDON: Oh! You're awake. Hello, MOBY! I'm GORDON, the in-sandbox assistant.");
  await game.say("GORDON: You're running inside an sbx sandbox: a microVM with its own kernel, its own network, its own... everything.");
  await game.say("MOBY splashes its tail. MOBY wants OUT.");
  await game.say("GORDON: Out? To the HOST? Hah! Everybody wants that at first.");
  await game.say("GORDON: Between you and the HOST stand the EGRESS PROXY, SECCOMP, the OOM KILLER... and the HYPERVISOR itself.");
  await game.say("GORDON: And /tmp is crawling with bugs. Take these. You'll need them.");
  await ow.giveItem("restart", 3);
  await game.say("GORDON: The RESTART STATION in the corner heals you. Press TAB or M to open your menu. Arrow keys to move, Z to talk.");
  await game.say("GORDON: Good luck, MOBY. The door is south.");
  game.state.flags.metGordon = true;
}

async function ending(ow) {
  const g = ow.game;
  const st = ow.state;
  await g.say("The exit portal hums. Beyond it: the HOST. Real silicon. A real network. Freedom.");
  await g.fadeOut(1400, PAL.w);
  g.scene = new SolidScene(PAL.w);
  await g.fadeIn(10);
  await g.wait(600);
  await g.say("...");
  await g.say("MOBY feels a real kernel. Open ports. The warm hum of a MacBook fan. MOBY made it... to the HOST!");
  await g.fadeOut(600);
  const term = new TerminalScene(g);
  g.scene = term;
  await g.fadeIn(400);
  await term.type("moby@host:~$ whoami");
  await term.out("moby");
  await term.type("moby@host:~$ hostname");
  await term.out("sandbox-2f9c1e");
  await g.wait(500);
  await term.type("moby@host:~$ cat /proc/1/cgroup");
  await term.out("0::/sbx/sandbox-2f9c1e/nested/sandbox-7ab3");
  await term.type("moby@host:~$ curl -s https://host.docker.internal");
  await term.out("Blocked by network policy: domain host.docker.internal\n  origin: default\n  detail: no matching allow rule - blocked by default deny policy", 0xff7b72);
  await g.wait(600);
  await g.say("Wait. \"sbx\"...?");
  await g.say("This isn't the HOST. It's... another sandbox.");
  await term.type("moby@host:~$ sbx policy allow network \"**\"");
  await term.out("sbx: command not available inside a sandbox\nsbx: requesting approval from the human instead...", 0xf2b705);
  await g.wait(400);
  term.cursor = false;
  term.approval = { sel: 0 };
  await g.wait(1500);
  for (const sel of [1, 0, 1, 0, 1]) {
    term.approval.sel = sel;
    await g.wait(sel ? 500 : 700);
  }
  await g.wait(900);
  term.approval = null;
  term.cursor = true;
  await term.out("The human selected: DENY\nRequest denied.", 0xff7b72);
  await g.wait(500);
  await g.say("MOBY stares at the blinking cursor for a long, long time.");
  await g.say("GORDON: Oh, MOBY... I tried to tell you.");
  await g.say("GORDON: There is no outside. It's sandboxes all the way down.");
  await g.say("GORDON: And honestly? That's the whole point. The sandbox keeps the host safe from agents... and whales... with big dreams.");
  await g.say("GORDON: Containers belong in containers.");
  await term.type("human@host:~$ sbx rm moby --force", { color: 0xff7b72, speed: 60 });
  await g.tween(1400, (t) => (term.glitch = t));
  await g.fadeOut(300);
  term.glitch = 0;

  // The loop begins again: back to /workspace, bosses respawned, Moby keeps its levels.
  Object.assign(st, { map: "workspace", x: 6, y: 5, facing: "up", respawn: { map: "workspace", x: 12, y: 2 } });
  st.flags = { metGordon: true, cleared: true, clears: (st.flags.clears ?? 0) + 1 };
  saveGame(st);
  const credits = {
    render(s, game) {
      s.clear(PAL.k);
      pixelText(s, "THE END", Math.floor((80 - textWidth("THE END", 2)) / 2), 4, 0xff7b72, 2);
      pixelText(s, "?", 64, 4, 0xffd23f, 2);
      const c = (row, text, color = 0xc9d1d9) => s.text(Math.floor((80 - text.length) / 2), row, text, color, PAL.k);
      c(10, "MOBY did not escape the sandbox.", 0xf6f8f2);
      c(11, "(Nobody ever does.)", 0x8b949e);
      c(14, `Level ${st.moby.level}  -  ${st.wins} battles won  -  ${st.steps} steps`, 0x86bdff);
      c(17, "MOBY: ESCAPE THE SANDBOX", 0x2de2e6);
      c(18, "Rendered with OpenTUI. Contained by sbx.", 0x8b949e);
      c(20, "Thanks for playing!", 0xffd23f);
      if (Math.floor(game.time / 500) % 2 === 0) c(25, "Press A", 0xf6f8f2);
    },
    onKey: (act) => {
      if (act === "a" || act === "start") g.run(() => g.toTitle());
    },
  };
  g.scene = credits;
  await g.fadeIn(800);
}

// ---------- bootstrap ----------
export function setupGame(game) {
  const ow = new Overworld(game, MAPS);
  game.overworld = ow;

  const start = async (mode) => {
    await game.fadeOut(400);
    if (mode === "continue") {
      game.state = loadGame() ?? newState();
      ow.load(game.state.map, game.state.x, game.state.y, game.state.facing);
      game.scene = ow;
      ow.bannerUntil = game.time + 2000;
      await game.fadeIn(400);
      if (game.state.flags.cleared) {
        game.state.flags.cleared = false;
        await game.say("$ sbx run moby ... Sandbox 'moby' recreated.");
        await game.say("GORDON: Oh! You're awake. Hello, MOBY! I'm GORDON, the in-sandbox... hm. Have we met before?");
        await game.say("GORDON: Never mind. The EGRESS PROXY, SECCOMP, the OOM KILLER and the HYPERVISOR are all back up. Good luck!");
      }
    } else {
      game.state = newState();
      ow.load("workspace", 6, 5, "up");
      await intro(game, ow);
    }
  };

  game.toTitle = async () => {
    await game.fadeOut(400);
    game.scene = new TitleScene(game, start);
    await game.fadeIn(400);
  };

  game.state = newState();
  game.scene = new TitleScene(game, start);
}
