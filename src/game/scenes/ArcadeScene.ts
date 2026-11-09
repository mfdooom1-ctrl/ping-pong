import Phaser from "phaser";
import { ARENAS, type Arena } from "../data/arenas";
import { ROSTER } from "../data/roster";
import { Random } from "../ai/opponent";
import type { Match } from "../physics/match";
import { PHYSICS as P } from "../physics/config";
import type { Controls } from "../input/controls";

export function project(x: number, y: number, z = 0) {
  const height = z > 1.2 ? 1.2 * 115 + (z - 1.2) * 48 : z * 115;
  return { x: 480 + y * 26 + x * (230 + y * 33), y: 276 + y * 70 - height };
}
export class ArcadeScene extends Phaser.Scene {
  match?: Match;
  controls?: Controls;
  private background!: Phaser.GameObjects.Image;
  private table!: Phaser.GameObjects.Graphics;
  private net!: Phaser.GameObjects.Graphics;
  private ballInk!: Phaser.GameObjects.Graphics;
  private trailInk!: Phaser.GameObjects.Graphics;
  private shadowInk!: Phaser.GameObjects.Graphics;
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private portraits: Phaser.GameObjects.Image[] = [];
  private accents!: Phaser.GameObjects.Graphics;
  private readyCallback: () => void;
  private trail: { x: number; y: number }[] = [];
  private arena = 0;
  private menu = true;
  private frame = 0;
  private pop = 0;
  private costume = "characters";
  onFrame: (match: Match, delta: number) => void = () => {};
  constructor(ready: () => void) {
    super("Arcade");
    this.readyCallback = ready;
  }
  preload() {
    const base = import.meta.env.BASE_URL;
    this.load.atlas(
      "characters",
      base + "assets/characters.png",
      base + "assets/characters.json",
    );
    this.load.json("character-data", base + "assets/characters.json");
    for (const c of ROSTER)
      this.load.image(
        "portrait-" + c.id,
        base + "assets/portrait-" + c.id + ".png",
      );
    this.load.on("loaderror", (file: { key: string }) => {
      document.getElementById("boot")!.innerHTML =
        "LOAD ERROR<span>Reload to retry: " + file.key + "</span>";
    });
  }
  create() {
    this.background = this.add.image(0, 0, "").setOrigin(0).setDepth(0);
    this.accents = this.add.graphics().setDepth(2);
    this.shadowInk = this.add.graphics().setDepth(8);
    this.sprites = [
      this.add
        .sprite(0, 0, "characters", "johnny-idle-0")
        .setOrigin(0.5, 1)
        .setDepth(50),
      this.add
        .sprite(0, 0, "characters", "jack-idle-0")
        .setOrigin(0.5, 1)
        .setDepth(10),
    ];
    this.table = this.add.graphics().setDepth(20);
    this.net = this.add.graphics().setDepth(35);
    this.trailInk = this.add.graphics().setDepth(42);
    this.ballInk = this.add.graphics().setDepth(44);
    this.portraits = [
      this.add
        .image(634, 432, "portrait-johnny")
        .setOrigin(0.5, 1)
        .setScale(2.5)
        .setDepth(6),
      this.add
        .image(816, 438, "portrait-tony")
        .setOrigin(0.5, 1)
        .setScale(2.35)
        .setDepth(7),
    ];
    this.home();
    this.readyCallback();
  }
  private polygon(
    g: Phaser.GameObjects.Graphics,
    points: { x: number; y: number }[],
    color: number,
    alpha = 1,
    stroke?: number,
  ) {
    g.fillStyle(color, alpha);
    g.fillPoints(points, true);
    if (stroke !== undefined) {
      g.lineStyle(2, stroke, 1);
      g.strokePoints(points, true);
    }
  }
  private bake(arena: Arena) {
    const key = "arena-" + arena.id;
    if (this.textures.exists(key)) {
      this.background.setTexture(key);
      return;
    }
    const g = this.make.graphics({ x: 0, y: 0 });
    const rnd = new Random(ARENAS.indexOf(arena) * 253 + 1982);
    g.fillStyle(arena.sky);
    g.fillRect(0, 0, 960, 540);
    for (let y = 60; y < 330; y += 4) {
      g.fillStyle(arena.glow, (y / 330) * 0.08);
      g.fillRect(0, y, 960, 4);
    }
    // A striped synthwave sun, a unique silhouette and a crisp illuminated skyline.
    if (["beach", "desert", "rooftop", "screens"].includes(arena.decor)) {
      for (let y = -66; y < 66; y += 4) {
        const width = Math.sqrt(66 ** 2 - y ** 2) * 2;
        g.fillStyle(y < 0 ? 0xffce7a : arena.glow, 0.82);
        g.fillRect(478 - width / 2, 145 + y, width, y > 20 ? 2 : 4);
      }
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0xaee9ee, rnd.range(0.1, 0.5));
      g.fillRect(rnd.range(15, 945) | 0, rnd.range(15, 160) | 0, 2, 2);
    }
    for (let x = -10; x < 970; ) {
      const w = rnd.range(24, 69) | 0;
      const h = rnd.range(35, 165) | 0;
      g.fillStyle(0x10142b);
      g.fillRect(x, 262 - h, w, h);
      g.fillStyle(arena.glow, 0.12);
      g.fillRect(x, 262 - h, w, 2);
      for (let wx = x + 5; wx < x + w - 4; wx += 8)
        for (let wy = 266 - h; wy < 253; wy += 10)
          if (rnd.next() > 0.42) {
            g.fillStyle(
              rnd.next() > 0.4 ? arena.glow : arena.accent,
              rnd.range(0.18, 0.54),
            );
            g.fillRect(wx, wy, 3, 4);
          }
      x += w + 4;
    }
    g.fillStyle(0x0b1125);
    g.fillRect(0, 270, 960, 270);
    g.fillStyle(arena.glow, 0.06);
    g.fillRect(0, 270, 960, 270);
    // Floor lines converge at the horizon; reflections stay outside the ball's flight.
    for (let x = -1000; x < 2000; x += 130) {
      g.lineStyle(1, arena.glow, 0.18);
      g.lineBetween(480 + (x - 480) * 0.06, 273, x, 540);
    }
    for (let y = 286; y < 540; y += (y - 260) * 0.3) {
      g.lineStyle(1, arena.glow, 0.18);
      g.lineBetween(0, y, 960, y);
    }
    const sign = (
      x: number,
      y: number,
      w: number,
      h: number,
      color: number,
    ) => {
      g.fillStyle(color, 0.08);
      g.fillRect(x - 6, y - 6, w + 12, h + 12);
      g.fillStyle(0x17132d);
      g.fillRect(x, y, w, h);
      g.lineStyle(2, color, 0.9);
      g.strokeRect(x, y, w, h);
      g.fillStyle(color, 0.55);
      g.fillRect(x + 7, y + 7, w - 14, 3);
    };
    const palm = (x: number, y: number, flip = 1) => {
      g.lineStyle(8, 0x18162b);
      g.lineBetween(x, y, x + 14 * flip, y - 90);
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI + Math.PI;
        g.lineStyle(5, 0x16172c);
        g.lineBetween(
          x + 14 * flip,
          y - 90,
          x + 14 * flip + Math.cos(a) * 52,
          y - 90 + Math.sin(a) * 31 + 15,
        );
      }
      g.lineStyle(2, arena.glow, 0.4);
      g.lineBetween(x + 5, y, x + 19 * flip, y - 85);
    };
    const machine = (x: number, y: number, color: number) => {
      this.polygon(
        g,
        [
          { x, y: y + 12 },
          { x: x + 9, y },
          { x: x + 48, y },
          { x: x + 56, y: y + 83 },
          { x: x - 3, y: y + 83 },
        ],
        0x17162d,
        1,
        color,
      );
      g.fillStyle(0x26334b);
      g.fillRect(x + 8, y + 13, 33, 29);
      g.fillStyle(color);
      g.fillRect(x + 12, y + 17, 25, 20);
      g.fillStyle(0x17162d);
      for (let j = 0; j < 5; j++)
        g.fillRect(x + 14 + j * 5, y + 21 + (j % 2) * 5, 3, 10);
      g.fillStyle(0xbfb4bd);
      g.fillRect(x + 5, y + 50, 40, 9);
      g.fillStyle(color);
      g.fillRect(x + 25, y + 52, 5, 3);
      g.fillStyle(0x33314d);
      g.fillRect(x + 9, y + 68, 28, 10);
    };
    if (arena.decor === "casino") {
      sign(31, 88, 206, 55, arena.glow);
      sign(740, 72, 183, 70, arena.accent);
      for (let i = 0; i < 4; i++) {
        machine(
          40 + i * 53,
          230 - (i % 2) * 3,
          i % 2 ? arena.accent : arena.glow,
        );
        machine(
          715 + i * 54,
          223 + (i % 2) * 4,
          i % 2 ? arena.glow : arena.accent,
        );
      }
      for (let x = 32; x < 240; x += 9) {
        g.fillStyle(arena.accent);
        g.fillRect(x, 80, 4, 4);
        g.fillRect(x, 150, 4, 4);
      }
      palm(255, 269);
      palm(695, 264, -1);
    } else if (arena.decor === "beach") {
      g.fillStyle(0x242446);
      g.fillRect(0, 241, 960, 36);
      for (let y = 246; y < 274; y += 7) {
        g.fillStyle(arena.glow, 0.35);
        g.fillRect(340 - (y - 240) * 2, y, 280 + (y - 240) * 4, 2);
      }
      palm(96, 302);
      palm(206, 276);
      palm(850, 301, -1);
      palm(748, 275, -1);
      sign(55, 160, 163, 31, arena.glow);
      for (let i = 0; i < 14; i++) {
        g.fillStyle(i % 2 ? arena.accent : arena.glow, 0.9);
        g.fillCircle(45 + i * 67, 70 + Math.sin((i / 13) * Math.PI) * 32, 3);
      }
      g.lineStyle(1, arena.accent, 0.5);
      g.lineBetween(0, 68, 480, 103);
      g.lineBetween(480, 103, 960, 68);
    } else if (
      arena.decor === "screens" ||
      arena.decor === "tokyo" ||
      arena.decor === "rain"
    ) {
      for (let side = 0; side < 2; side++)
        for (let i = 0; i < 4; i++) {
          const x = side === 0 ? 25 + i * 53 : 740 + i * 50;
          const y = 80 + (i % 2) * 40;
          sign(x, y, 35, 110 - i * 8, i % 2 ? arena.accent : arena.glow);
          g.fillStyle(i % 2 ? arena.glow : arena.accent, 0.7);
          for (let j = 0; j < 6; j++)
            g.fillRect(x + 9, y + 19 + j * 12, 17 - (j % 2) * 6, 4);
        }
      g.fillStyle(arena.accent, 0.13);
      g.fillRect(60, 280, 110, 3);
      g.fillRect(752, 290, 125, 3);
      if (arena.decor === "tokyo") {
        g.fillStyle(0x852945);
        g.fillRect(45, 205, 190, 8);
        g.fillRect(70, 205, 8, 80);
        g.fillRect(207, 205, 8, 80);
      }
    } else if (arena.decor === "lanterns") {
      g.lineStyle(2, 0x964759);
      g.lineBetween(0, 90, 480, 126);
      g.lineBetween(480, 126, 960, 90);
      for (let i = 0; i < 11; i++) {
        const x = 45 + i * 87,
          y = 97 + Math.sin((i / 10) * Math.PI) * 30;
        g.fillStyle(0xffca71, 0.07);
        g.fillCircle(x, y + 20, 29);
        g.fillStyle(0xc83651);
        g.fillEllipse(x, y + 17, 24, 32);
        g.fillStyle(arena.accent);
        g.fillRect(x - 9, y, 18, 3);
        g.fillRect(x - 9, y + 31, 18, 3);
        g.fillRect(x - 1, y + 33, 2, 10);
      }
      sign(47, 165, 175, 44, arena.accent);
      sign(738, 165, 175, 44, arena.glow);
    } else if (arena.decor === "hall") {
      g.fillStyle(0x44313d);
      g.fillRect(0, 45, 280, 225);
      g.fillRect(680, 45, 280, 225);
      for (let x = 0; x < 280; x += 20) {
        g.fillStyle(0x6b4650, 0.4);
        g.fillRect(x, 45, 2, 225);
        g.fillRect(x + 680, 45, 2, 225);
      }
      sign(42, 84, 174, 77, arena.accent);
      sign(744, 84, 174, 77, arena.accent);
      for (let y = 240; y < 315; y += 17) {
        g.fillStyle(0x91645b);
        g.fillRect(20, y, 228, 6);
        g.fillRect(711, y, 228, 6);
      }
      g.fillStyle(0xbc5f63);
      g.fillRect(450, 52, 60, 30);
      g.fillStyle(arena.accent);
      g.fillPoints(
        Array.from({ length: 10 }, (_, i) => ({
          x: 480 + Math.sin((i * Math.PI) / 5) * (i % 2 ? 5 : 12),
          y: 67 - Math.cos((i * Math.PI) / 5) * (i % 2 ? 5 : 12),
        })),
        true,
      );
    } else if (arena.decor === "desert") {
      this.polygon(
        g,
        [
          { x: 0, y: 254 },
          { x: 0, y: 214 },
          { x: 70, y: 178 },
          { x: 146, y: 221 },
          { x: 218, y: 193 },
          { x: 280, y: 260 },
        ],
        0x573244,
      );
      this.polygon(
        g,
        [
          { x: 700, y: 260 },
          { x: 820, y: 174 },
          { x: 900, y: 202 },
          { x: 960, y: 187 },
          { x: 960, y: 260 },
        ],
        0x573244,
      );
      sign(42, 133, 169, 52, arena.glow);
      g.fillStyle(0x65344b);
      g.fillRect(713, 172, 210, 90);
      for (let i = 0; i < 5; i++) {
        g.fillStyle(arena.accent, 0.5);
        g.fillRect(724 + i * 40, 194, 22, 35);
      }
      g.fillStyle(0x162638);
      g.fillRect(250, 219, 10, 60);
      g.fillRect(234, 232, 40, 9);
      g.fillRect(234, 215, 7, 24);
    } else if (arena.decor === "arcade") {
      for (let i = 0; i < 5; i++) {
        machine(8 + i * 48, 170 + i * 12, i % 2 ? arena.glow : arena.accent);
        machine(714 + i * 48, 218 - i * 12, i % 2 ? arena.accent : arena.glow);
      }
      sign(360, 58, 240, 46, arena.glow);
    } else if (arena.decor === "warehouse") {
      for (let x = 15; x < 960; x += 145) {
        g.fillStyle(0x34404a);
        g.fillRect(x, 0, 9, 283);
        g.fillRect(x, 60, 145, 8);
      }
      for (let side = 0; side < 2; side++)
        for (let i = 0; i < 3; i++) {
          let x = side ? 755 + i * 48 : 30 + i * 48;
          g.fillStyle(0x685046);
          g.fillRect(x, 223 - (i % 2) * 40, 43, 63 + (i % 2) * 40);
          g.lineStyle(2, 0xa07957, 0.7);
          g.strokeRect(x + 4, 227 - (i % 2) * 40, 35, 54 + (i % 2) * 40);
          g.lineBetween(x + 4, 227 - (i % 2) * 40, x + 39, 281);
        }
      for (let x = 170; x < 900; x += 310) {
        g.lineStyle(2, 0x3a4051);
        g.lineBetween(x, 0, x, 130);
        g.fillStyle(arena.accent);
        g.fillTriangle(x - 20, 149, x, 128, x + 20, 149);
        g.fillStyle(arena.accent, 0.04);
        g.fillTriangle(x, 147, x - 130, 345, x + 130, 345);
      }
    } else if (arena.decor === "penthouse") {
      for (let x = 22; x < 960; x += 116) {
        g.fillStyle(0x736053);
        g.fillRect(x, 40, 5, 235);
      }
      g.fillStyle(0x9a795a);
      g.fillRect(20, 268, 920, 6);
      g.fillStyle(0x3b2b45);
      g.fillRect(25, 280, 206, 31);
      g.fillRect(729, 280, 206, 31);
      g.fillStyle(arena.accent, 0.8);
      for (let i = 0; i < 9; i++) {
        const x = 420 + i * 15;
        g.fillRect(x, 63 + Math.abs(i - 4) * 5, 3, 37);
        g.fillCircle(x + 1, 102 + Math.abs(i - 4) * 5, 3);
      }
    } else {
      g.fillStyle(0x26314b);
      g.fillRect(30, 241, 235, 35);
      g.fillRect(697, 241, 233, 35);
      g.lineStyle(2, arena.glow, 0.7);
      g.lineBetween(30, 239, 265, 239);
      g.lineBetween(697, 239, 930, 239);
      g.fillStyle(0x292640);
      g.fillRect(71, 169, 63, 70);
      g.fillStyle(arena.accent, 0.45);
      g.fillRect(79, 176, 47, 53);
      g.fillStyle(0x10182d);
      g.fillRect(139, 135, 8, 104);
    }
    // Small, original animated-by-light crowd silhouettes along the sidelines.
    for (let i = 0; i < 18; i++) {
      const x = i < 9 ? 32 + i * 25 : 711 + (i - 9) * 25;
      const y = 318 + (i % 3) * 5;
      g.fillStyle(0x1c1c36);
      g.fillCircle(x, y - 17, 5);
      g.fillRect(x - 5, y - 12, 10, 19);
      g.fillStyle(i % 3 === 0 ? arena.glow : arena.accent, 0.35);
      g.fillRect(x - 4, y - 10, 8, 3);
    }
    g.generateTexture(key, 960, 540);
    g.destroy();
    this.background.setTexture(key);
  }
  private drawTable(arena: Arena) {
    this.table.clear();
    this.net.clear();
    const g = this.table;
    const corners = [
      project(-P.halfWidth, -P.halfLength),
      project(P.halfWidth, -P.halfLength),
      project(P.halfWidth, P.halfLength),
      project(-P.halfWidth, P.halfLength),
    ];
    this.polygon(
      g,
      corners.map((p) => ({ x: p.x, y: p.y + 25 })),
      0x040919,
      0.45,
    );
    for (const x of [-0.58, 0.58])
      for (const y of [-1, 1]) {
        const a = project(x, y, -0.035),
          b = project(x, y, -0.76);
        g.lineStyle(9, 0x10172e);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(2, arena.glow, 0.55);
        g.lineBetween(a.x + 3, a.y, b.x + 3, b.y);
        g.fillStyle(0x090d20);
        g.fillRect(b.x - 8, b.y, 16, 5);
      }
    this.polygon(
      g,
      [
        corners[3],
        corners[2],
        { x: corners[2].x, y: corners[2].y + 12 },
        { x: corners[3].x, y: corners[3].y + 12 },
      ],
      0x152239,
      1,
      0x283650,
    );
    this.polygon(
      g,
      [
        corners[1],
        corners[2],
        { x: corners[2].x, y: corners[2].y + 12 },
        { x: corners[1].x, y: corners[1].y + 10 },
      ],
      0x182a44,
    );
    this.polygon(g, corners, arena.table, 1, 0xc1ece6);
    const mid = project(0, -P.halfLength),
      mid2 = project(0, P.halfLength);
    g.lineStyle(1, 0xc6f1e8, 0.7);
    g.lineBetween(mid.x, mid.y, mid2.x, mid2.y);
    g.lineStyle(1, arena.glow, 0.15);
    for (let y = -1.2; y < 1.3; y += 0.12) {
      const a = project(-0.73, y),
        b = project(0.73, y);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    const n = this.net;
    const left = project(-0.81, 0),
      right = project(0.81, 0);
    const topL = project(-0.81, 0, P.netHeight),
      topR = project(0.81, 0, P.netHeight);
    this.polygon(n, [left, right, topR, topL], 0x081329, 0.6);
    n.lineStyle(1, 0x7badaf, 0.55);
    for (let x = -0.78; x < 0.8; x += 0.035) {
      const a = project(x, 0),
        b = project(x, 0, P.netHeight);
      n.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let z = 0; z < P.netHeight; z += 0.032) {
      const a = project(-0.81, 0, z),
        b = project(0.81, 0, z);
      n.lineBetween(a.x, a.y, b.x, b.y);
    }
    n.lineStyle(2, 0xc8f6e4);
    n.lineBetween(topL.x, topL.y, topR.x, topR.y);
    n.lineStyle(3, arena.glow);
    n.lineBetween(left.x, left.y + 4, topL.x, topL.y - 3);
    n.lineBetween(right.x, right.y + 4, topR.x, topR.y - 3);
  }
  home() {
    this.menu = true;
    this.match = undefined;
    this.controls = undefined;
    this.arena = 3;
    this.bake(ARENAS[3]);
    this.table.setVisible(false);
    this.net.setVisible(false);
    this.sprites.forEach((s) => s.setVisible(false));
    this.portraits.forEach((p) => p.setVisible(true));
    this.ballInk?.clear();
    this.trailInk?.clear();
    this.shadowInk?.clear();
  }
  previewArena(index: number) {
    this.arena = index;
    this.bake(ARENAS[index]);
  }
  start(match: Match, controls: Controls) {
    this.menu = false;
    this.match = match;
    this.controls = controls;
    this.arena = match.config.arena;
    this.bake(ARENAS[this.arena]);
    this.drawTable(ARENAS[this.arena]);
    this.table.setVisible(true);
    this.net.setVisible(true);
    this.portraits.forEach((p) => p.setVisible(false));
    this.sprites.forEach((s) => s.setVisible(true));
    this.trail = [];
  }
  impact() {
    this.pop = 0.12;
  }
  setCosmetics(outfit: number, paddle: number) {
    if (outfit === 0 && paddle === 0) {
      this.costume = "characters";
      return;
    }
    const key = `costume-${outfit}-${paddle}`;
    this.costume = key;
    if (this.textures.exists(key)) return;
    const source = this.textures
      .get("characters")
      .getSourceImage() as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(source, 0, 0);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const shirts = [
      0xf33966, 0xe5e1cb, 0xdc3f5e, 0x57c998, 0xdb5695, 0x8d74cd, 0xc75b32,
      0xe2ba47, 0xd6a643, 0x25b99e, 0x4c76b8, 0xbc52ba, 0xdf5e4a, 0x34a8dd,
    ];
    for (let i = 0; i < image.data.length; i += 4) {
      const color =
        (image.data[i] << 16) + (image.data[i + 1] << 8) + image.data[i + 2];
      let replace = 0;
      if (outfit && shirts.includes(color))
        replace = outfit === 1 ? 0x47c4d8 : 0xe7bd5d;
      if (paddle && (color === 0xfc4568 || color === 0x4fd8e0))
        replace = paddle === 1 ? 0xad6aff : 0xffd66b;
      if (replace) {
        image.data[i] = replace >> 16;
        image.data[i + 1] = (replace >> 8) & 255;
        image.data[i + 2] = replace & 255;
      }
    }
    context.putImageData(image, 0, 0);
    const texture = this.textures.addCanvas(key, canvas)!;
    this.textures.addAtlas(key, texture, this.cache.json.get("character-data"));
  }
  update(time: number, delta: number) {
    this.frame++;
    const g = this.accents;
    g.clear();
    const arena = ARENAS[this.arena];
    if (arena.decor === "rain")
      for (let i = 0; i < 35; i++) {
        const x = (i * 79 + time * 0.06) % 960,
          y = (i * 113 + time * 0.2) % 540;
        if (x > 280 && x < 730) continue;
        g.lineStyle(1, 0x75dfe6, 0.3);
        g.lineBetween(x, y, x - 4, y + 13);
      }
    for (let i = 0; i < 5; i++) {
      const x = (time * 0.006 + i * 193) % 960;
      g.fillStyle(arena.glow, 0.2);
      g.fillRect(x, 110 + i * 39 + Math.sin(time * 0.001 + i) * 8, 2, 2);
    }
    if (this.menu) {
      this.portraits[0].y = 433 + Math.round(Math.sin(time * 0.0018) * 2);
      this.portraits[1].y = 439 + Math.round(Math.sin(time * 0.0018 + 1) * 2);
      return;
    }
    const m = this.match;
    if (!m) return;
    this.controls?.update();
    m.update(delta / 1000, this.controls ?? { x: 0, y: 0 });
    this.shadowInk.clear();
    m.players.forEach((p, i) => {
      const at = project(p.x, p.y, P.floor);
      const scale = 3.55 + p.y * 0.25;
      const frame = Math.floor(p.animTime * 10) % 4;
      const sprite = this.sprites[i];
      sprite
        .setPosition(Math.round(at.x), Math.round(at.y + 3))
        .setScale(scale)
        .setTexture(
          i === 0 ? this.costume : "characters",
          `${p.character.id}-${p.animation}-${frame}`,
        );
      if (
        i === 0 &&
        m.config.hero === "johnny" &&
        m.config.options.manualHand === "backhand"
      )
        sprite.setFlipX(true);
      else sprite.setFlipX(i === 1);
      this.shadowInk.fillStyle(0x000918, 0.4);
      this.shadowInk.fillEllipse(at.x, at.y, 40 * scale, 8 * scale);
    });
    const b = m.ball;
    const at = project(b.p.x, b.p.y, b.p.z);
    const shadow = project(
      b.p.x,
      b.p.y,
      Math.abs(b.p.x) < P.halfWidth && Math.abs(b.p.y) < P.halfLength
        ? 0
        : P.floor,
    );
    const ink = this.ballInk;
    ink.clear();
    this.trailInk.clear();
    if (m.state === "playing" || m.state === "toss" || m.state === "ready") {
      ink.fillStyle(0x05091b, 0.45);
      ink.fillEllipse(shadow.x, shadow.y, 12 + Math.max(0, b.p.z) * 4, 5);
      if (this.frame % 2 === 0) {
        this.trail.unshift({ x: at.x, y: at.y });
        if (this.trail.length > 8) this.trail.pop();
      }
      const spinning = Math.hypot(b.w.x, b.w.y, b.w.z) > 120;
      if (spinning && m.state === "playing")
        for (let i = 1; i < this.trail.length; i++) {
          this.trailInk.fillStyle(
            b.w.z > 50 ? 0x64f7e7 : b.w.z < -50 ? 0xf779dc : 0xffc86a,
            (1 - i / this.trail.length) * 0.35,
          );
          this.trailInk.fillRect(
            this.trail[i].x - 2,
            this.trail[i].y - 2,
            4,
            4,
          );
        }
      ink.fillStyle(0x08112c);
      ink.fillRect(Math.round(at.x) - 5, Math.round(at.y) - 5, 11, 11);
      ink.fillStyle(0xfff0b5);
      ink.fillRect(Math.round(at.x) - 3, Math.round(at.y) - 3, 7, 7);
      ink.fillStyle(0xffffff);
      ink.fillRect(Math.round(at.x) - 2, Math.round(at.y) - 2, 3, 3);
      if (m.training || m.config.options.difficulty === "ROOKIE") {
        if (m.predicted && b.v.y > 0) {
          const p = project(m.predicted.x, m.predicted.y);
          ink.lineStyle(1, 0x80ffdc, 0.7);
          ink.strokeEllipse(p.x, p.y, 22, 9);
        }
        const p = project(m.players[0].x, m.playerPlane, 0.23);
        ink.lineStyle(
          2,
          m.pending ? 0xffd47a : 0x6ffff0,
          m.pending ? 0.8 : 0.32,
        );
        ink.strokeCircle(p.x, p.y, 16);
        ink.fillStyle(0x6ffff0, 0.2);
        ink.fillRect(p.x - 1, p.y - 3, 2, 6);
      }
    } else this.trail = [];
    ink.setDepth(b.p.y < 0 && b.p.z < P.netHeight ? 32 : 60);
    if (this.pop > 0) {
      this.pop -= delta / 1000;
      g.lineStyle(2, 0xffe6a7, this.pop * 6);
      g.strokeCircle(at.x, at.y, 8 + (1 - this.pop / 0.12) * 14);
    }
    this.onFrame(m, delta);
  }
}
