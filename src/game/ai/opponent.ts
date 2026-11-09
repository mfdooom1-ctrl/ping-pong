import { forecast, clamp, type Ball } from "../physics/ball";
import type { Character } from "../data/roster";
import type { ShotId, ServeId } from "../data/shots";
export class Random {
  constructor(public seed = 1982) {}
  next() {
    let x = this.seed | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x;
    return (x >>> 0) / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
}
export interface AIPlan {
  x: number;
  y: number;
  shot: ShotId;
  aim: number;
  error: number;
  state: string;
}
export class OpponentAI {
  rng: Random;
  timer = 0;
  plan: AIPlan = {
    x: 0,
    y: -1.51,
    shot: "flat",
    aim: 0,
    error: 0,
    state: "READING",
  };
  constructor(
    public character: Character,
    public difficulty: "ROOKIE" | "PRO" | "LEGEND",
    seed = 1982,
  ) {
    this.rng = new Random(seed);
  }
  update(
    dt: number,
    ball: Ball,
    playerX: number,
    rally: number,
    coach = false,
    challenge = "",
  ) {
    this.timer -= dt;
    if (this.timer > 0) return this.plan;
    const c = this.character;
    const factor =
      this.difficulty === "ROOKIE"
        ? 1.4
        : this.difficulty === "LEGEND"
          ? 0.7
          : 1;
    this.timer = c.reaction * factor;
    const predict = forecast(ball, -1.51);
    const uncertainty = (1 - c.spinReading * 0.65) * factor;
    const error =
      this.rng.range(-1, 1) * (0.055 + (1 - c.accuracy) * 0.25) * factor;
    let shot: ShotId = c.preferred;
    let aim = -Math.sign(playerX || this.rng.range(-1, 1)) * 0.52;
    let y = -1.51;
    switch (c.tactic) {
      case "corners":
        shot = rally % 2 ? "side-left" : "side-right";
        aim = rally % 2 ? -0.6 : 0.6;
        break;
      case "short":
        shot = playerX === 0 ? "push" : rally % 3 ? "drop" : "flick";
        y = -1.4;
        break;
      case "attack":
        shot = predict.point.z > 0.63 ? "smash" : "fore-loop";
        break;
      case "counter":
        shot = Math.abs(ball.w.x) > 100 ? "counter" : "block";
        break;
      case "power":
        shot = predict.point.z > 0.68 ? "smash" : "forehand";
        aim *= 0.8;
        break;
      case "rush":
        shot =
          predict.point.z < 0.33
            ? "flick"
            : rally % 2
              ? "back-loop"
              : "forehand";
        y = -1.4;
        break;
      case "gamble":
        shot =
          predict.point.z > 0.52 && this.rng.next() < c.risk
            ? "smash"
            : this.rng.next() < 0.5
              ? "fore-loop"
              : "drop";
        aim = this.rng.range(-0.65, 0.65);
        break;
      case "deception":
        shot =
          rally % 3 === 0 ? "drop" : rally % 2 ? "side-left" : "side-right";
        aim = this.rng.next() < 0.3 ? playerX * 0.6 : aim;
        break;
      case "defend":
        shot =
          Math.hypot(ball.v.x, ball.v.y) > 5
            ? "block"
            : rally % 3
              ? "backspin"
              : "lob";
        aim = this.rng.range(-0.2, 0.2);
        y = -1.68;
        break;
      case "rhythm":
        shot = rally % 3 === 2 ? "fore-loop" : "backhand";
        aim = rally % 2 ? -0.56 : 0.56;
        break;
      case "tempo":
        shot =
          rally % 3 === 0 ? "push" : rally % 3 === 1 ? "backspin" : "flick";
        break;
    }
    if (coach) {
      shot = challenge === "smash" ? "lob" : "block";
      aim = 0;
      y = -1.51;
    }
    if (predict.point.z > 1.3) shot = "lob";
    this.plan = {
      x: clamp(
        predict.point.x + ball.w.z * 0.0007 * uncertainty + error,
        -1.16,
        1.16,
      ),
      y,
      shot,
      aim,
      error: coach ? 0 : error * 0.55,
      state: ball.v.y < 0 ? "INTERCEPT / " + shot.toUpperCase() : "RECOVER",
    };
    if (ball.v.y > 0) this.plan.x *= 0.4;
    return this.plan;
  }
  serveStyle(): ServeId {
    const styles: ServeId[] =
      this.character.tactic === "short"
        ? ["SHORT", "BACKSPIN"]
        : this.character.tactic === "power"
          ? ["FAST", "LONG"]
          : this.character.tactic === "corners"
            ? ["PENDULUM", "SIDESPIN", "MIXED"]
            : ["LONG", "TOPSPIN", "BACKSPIN", "SIDESPIN"];
    return styles[Math.floor(this.rng.next() * styles.length)];
  }
}
