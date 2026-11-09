import { PHYSICS as P } from "./config";
import {
  clamp,
  copyBall,
  forecast,
  lerp,
  makeBall,
  racketCrossing,
  stepBall,
  vec,
  type Ball,
  type V3,
} from "./ball";
import { Rules, type Side } from "./rules";
import {
  serve,
  SERVES,
  shotById,
  strike,
  timingFor,
  type ServeId,
  type ShotId,
  type Timing,
} from "../data/shots";
import { character, type Character } from "../data/roster";
import { OpponentAI } from "../ai/opponent";
import type { Options } from "../data/save";
import type { Gesture } from "../input/controls";
export type Mode = "quick" | "story" | "tournament" | "training" | "challenge";
export interface MatchConfig {
  hero: string;
  opponent: string;
  arena: number;
  mode: Mode;
  options: Options;
  drill?: string;
  challenge?: string;
  seed?: number;
}
export interface Actor {
  x: number;
  y: number;
  vx: number;
  animation: string;
  animTime: number;
  character: Character;
}
export interface MatchEvent {
  type:
    | "hit"
    | "bounce"
    | "net"
    | "point"
    | "end"
    | "timing"
    | "serve"
    | "let"
    | "challenge";
  side?: Side;
  shot?: ShotId;
  timing?: Timing;
  text?: string;
}
export type MatchState = "ready" | "toss" | "playing" | "point" | "over";
export interface MatchSnapshot {
  config: MatchConfig;
  score: [number, number];
  server: Side;
  initialServer: Side;
  state: MatchState;
  ball: Ball;
  players: { x: number; y: number }[];
  phase: Rules["phase"];
  lastHit: Side;
  bounces: number;
  touchedNet: boolean;
  rally: number;
  bestRally: number;
  stats: Match["stats"];
  timer: number;
  clock: number;
  rng: number;
  serveStyle: ServeId;
  served: ServeId[];
  returnRally: number;
  landing?: { side: Side; shot: ShotId; timing: Timing };
}
export class Match {
  ball = makeBall();
  rules: Rules;
  ai: OpponentAI;
  players: [Actor, Actor];
  state: MatchState = "ready";
  paused = false;
  timer = 0;
  clock = 0;
  rally = 0;
  bestRally = 0;
  accumulator = 0;
  serveStyle: ServeId = "LONG";
  served = new Set<ServeId>();
  pending?: { gesture: Gesture; at: number; error: number };
  predicted?: V3;
  feedback = "TAP TO SERVE";
  lastShot = "FLAT DRIVE";
  lastTiming: Timing = "GOOD";
  stats = { returns: 0, spin: 0, perfect: 0, smash: 0, serve: 0, rally: 0 };
  private returnRally = 0;
  private landing?: { side: Side; shot: ShotId; timing: Timing };
  private hintTimer = 0;
  private assistX = 0;
  private challengeDone = false;
  onEvent: (e: MatchEvent) => void = () => {};
  constructor(public config: MatchConfig) {
    this.rules = new Rules(config.options.points);
    this.rules.begin();
    this.ai = new OpponentAI(
      character(config.opponent),
      config.options.difficulty,
      config.seed ?? 1982,
    );
    this.players = [
      {
        x: 0,
        y: 1.55,
        vx: 0,
        animation: "idle",
        animTime: 0,
        character: character(config.hero),
      },
      {
        x: 0,
        y: -1.55,
        vx: 0,
        animation: "idle",
        animTime: 0,
        character: character(config.opponent),
      },
    ];
    this.prepare();
  }
  private emit(event: MatchEvent) {
    this.onEvent(event);
  }
  get training() {
    return this.config.mode === "training";
  }
  get coach() {
    return this.training || this.config.mode === "challenge";
  }
  get smashAvailable() {
    return (
      this.state === "playing" &&
      this.ball.v.y > 0 &&
      this.ball.p.z > 0.55 &&
      this.ball.p.y > 0.3
    );
  }
  get playerPlane() {
    return this.players[0].y - 0.12;
  }
  get aiPlane() {
    return this.players[1].y + 0.12;
  }
  prepare() {
    this.state = "ready";
    this.timer = 0;
    this.pending = undefined;
    this.rally = 0;
    this.returnRally = 0;
    this.landing = undefined;
    this.rules.begin();
    this.ball.active = false;
    const side = this.rules.server;
    this.ball.p = vec(this.players[side].x, side === 0 ? 1.31 : -1.31, 0.32);
    this.ball.v = vec();
    this.ball.w = vec();
    this.feedback = side === 0 ? "TAP TO SERVE" : "OPPONENT SERVES";
    this.players.forEach((p) => {
      p.animation = "idle";
    });
  }
  input(g: Gesture) {
    if (this.paused || this.state === "over") return;
    if (this.state === "ready" && this.rules.server === 0) {
      this.state = "toss";
      this.timer = 0;
      this.emit({ type: "serve", side: 0 });
      return;
    }
    if (this.state !== "playing") return;
    const predict = forecast(this.ball, this.playerPlane);
    this.pending = { gesture: g, at: this.clock, error: -predict.time };
    this.players[0].animation = "windup";
    this.players[0].animTime = 0;
    // A small late-contact volume makes a late swing possible without teleporting the ball.
    if (
      this.ball.v.y > 0 &&
      this.ball.p.y > this.playerPlane &&
      this.ball.p.y - this.playerPlane < 0.14
    ) {
      this.pending.error =
        (this.ball.p.y - this.playerPlane) / Math.max(1, this.ball.v.y);
      this.contact(0, this.ball.p);
    }
  }
  update(delta: number, input: { x: number; y: number }) {
    if (this.paused || this.state === "over") return;
    const scale = this.training ? 0.68 : 1;
    this.accumulator += Math.min(delta, 0.1) * scale;
    let ticks = 0;
    while (this.accumulator >= P.step && ticks++ < 16) {
      this.tick(P.step, input);
      this.accumulator -= P.step;
    }
  }
  private tick(dt: number, input: { x: number; y: number }) {
    this.clock += dt;
    this.timer += dt;
    for (const p of this.players) {
      p.animTime += dt;
      if (
        p.animTime > 0.32 &&
        p.animation !== "idle" &&
        p.animation !== "move" &&
        this.state !== "over"
      )
        p.animation = "idle";
    }
    if (this.state === "point") {
      if (this.timer > 1.3) this.prepare();
      return;
    }
    if (this.state === "ready") {
      this.ball.p.x = this.players[this.rules.server].x;
      if (this.rules.server === 1 && this.timer > 1.05) {
        this.state = "toss";
        this.timer = 0;
        this.emit({ type: "serve", side: 1 });
      }
      return;
    }
    if (this.state === "toss") {
      this.ball.p.z =
        0.32 + Math.sin(Math.min(1, this.timer / 0.52) * Math.PI) * 0.65;
      if (this.timer >= 0.52) {
        const side = this.rules.server;
        const style = side === 0 ? this.serveStyle : this.ai.serveStyle();
        serve(
          this.ball,
          side,
          style,
          this.players[side].x,
          this.players[side].character.spinReading,
        );
        this.state = "playing";
        this.timer = 0;
        this.emit({ type: "hit", side, shot: "flat" });
      }
      return;
    }
    this.hintTimer -= dt;
    if (this.hintTimer <= 0) {
      const prediction = forecast(this.ball, this.playerPlane);
      this.predicted = prediction.bounce;
      this.assistX = prediction.point.x;
      this.hintTimer = 0.075;
    }
    const p = this.players[0];
    const assist =
      this.config.options.assist &&
      Math.abs(input.x) < 0.12 &&
      this.ball.v.y > 0;
    const target = clamp(this.assistX, -1.12, 1.12);
    const vx = assist
      ? clamp(
          (target - p.x) * 6,
          -p.character.footwork * 0.82,
          p.character.footwork * 0.82,
        )
      : input.x * p.character.footwork;
    p.vx = vx;
    p.x = clamp(p.x + vx * dt, -1.2, 1.2);
    p.y = clamp(p.y + input.y * dt * 1.1, 1.3, 1.96);
    if (Math.abs(vx) > 0.25 && p.animation === "idle") p.animation = "move";
    if (Math.abs(vx) < 0.1 && p.animation === "move") p.animation = "idle";
    const ai = this.players[1];
    const oldAiY = this.aiPlane;
    const plan = this.ai.update(
      dt,
      this.ball,
      p.x,
      this.rally,
      this.coach,
      this.config.challenge,
    );
    const speed =
      ai.character.footwork *
      (this.config.options.difficulty === "ROOKIE"
        ? 0.8
        : this.config.options.difficulty === "LEGEND"
          ? 1.05
          : 1);
    ai.vx = clamp((plan.x - ai.x) * 8, -speed, speed);
    ai.x = clamp(ai.x + ai.vx * dt, -1.2, 1.2);
    ai.y += clamp(plan.y - ai.y, -dt, dt);
    if (Math.abs(ai.vx) > 0.2 && ai.animation === "idle") ai.animation = "move";
    if (Math.abs(ai.vx) < 0.1 && ai.animation === "move") ai.animation = "idle";
    const before = { ...this.ball.p };
    stepBall(this.ball, dt, (c) => {
      if (this.state !== "playing") return;
      if (c.type === "table" || c.type === "edge") {
        this.emit({ type: "bounce" });
        const oldPhase = this.rules.phase;
        const result = this.rules.bounce(c.position.y > 0 ? 0 : 1);
        if (
          result === null &&
          oldPhase === "rally" &&
          this.rules.bounces === 1 &&
          this.landing
        ) {
          if (this.landing.side === 0) {
            this.stats.returns++;
            this.returnRally++;
            this.stats.rally = Math.max(this.stats.rally, this.returnRally);
            if (this.landing.timing === "PERFECT") this.stats.perfect++;
            if (
              [
                "topspin",
                "fore-loop",
                "back-loop",
                "side-left",
                "side-right",
                "counter",
              ].includes(this.landing.shot)
            )
              this.stats.spin++;
            if (this.landing.shot === "smash") this.stats.smash++;
          }
          this.landing = undefined;
          this.checkChallenge();
        }
        if (
          oldPhase === "receiver-bounce" &&
          result === null &&
          this.rules.server === 0
        ) {
          this.served.add(this.serveStyle);
          this.stats.serve = this.served.size;
          this.checkChallenge();
        }
        if (result === "let") {
          this.ball.active = false;
          this.state = "point";
          this.timer = 0.3;
          this.feedback = "LET — SERVE AGAIN";
          this.emit({ type: "let", text: this.feedback });
        } else if (result !== null)
          this.point(result, "DOUBLE BOUNCE / WRONG SIDE");
      } else if (c.type === "net") {
        this.rules.net();
        this.emit({ type: "net" });
      } else if (c.type === "floor")
        this.point(this.rules.out(), "OUT / MISSED RETURN");
    });
    if (this.state !== "playing") return;
    for (const side of [0, 1] as Side[]) {
      if (
        (side === 0 && this.ball.v.y <= 0) ||
        (side === 1 && this.ball.v.y >= 0)
      )
        continue;
      const plane = side === 0 ? this.playerPlane : this.aiPlane;
      const ratio = racketCrossing(
        before,
        this.ball.p,
        side === 0 ? plane : oldAiY,
        plane,
      );
      if (ratio !== null) {
        const pos = vec(
          lerp(before.x, this.ball.p.x, ratio),
          plane,
          lerp(before.z, this.ball.p.z, ratio),
        );
        this.contact(side, pos);
      }
    }
    if (Math.abs(this.ball.p.x) > 2.5 || Math.abs(this.ball.p.y) > 3.8)
      this.point(this.rules.out(), "WIDE / LONG");
    if (this.pending && this.clock - this.pending.at > 0.36) {
      this.pending = undefined;
      this.lastTiming = "MISS";
      this.emit({ type: "timing", timing: "MISS" });
    }
  }
  private contact(side: Side, pos: V3) {
    const actor = this.players[side];
    const emergency = side === 0 && this.pending?.gesture.shot === "save";
    const reach = P.paddleReach * (emergency ? 1.5 : 1);
    if (
      Math.abs(pos.x - actor.x) > reach ||
      pos.z < 0.025 ||
      pos.z > P.paddleHeight
    )
      return;
    if (side === 0 && !this.pending) return;
    const invalid = this.rules.hit(side);
    if (invalid !== null) {
      this.point(invalid, "VOLLEY / ILLEGAL RETURN");
      return;
    }
    let shot: ShotId,
      aim: number,
      charge = 0,
      mixed = 0,
      error = 0;
    if (side === 0) {
      const pending = this.pending!;
      ({ shot, aim, charge, mixed } = pending.gesture);
      error = pending.error;
      const timing = timingFor(error, shotById(shot));
      this.lastTiming = timing;
      this.emit({ type: "timing", timing });
      this.pending = undefined;
      if (timing === "MISS") {
        this.rules.lastHit = 1;
        this.rules.bounces = 1;
        actor.animation = "miss";
        actor.animTime = 0;
        return;
      }
      if (shot === "flat" && this.config.options.manualHand !== "auto")
        shot = this.config.options.manualHand;
      if (shot === "smash" && pos.z < 0.5) {
        error += 0.08;
      }
      if (
        charge > 0.82 &&
        (actor.character.id === "johnny" || Math.abs(mixed) > 0)
      ) {
        shot = actor.character.id === "tony" ? "fore-loop" : "forehand";
        this.feedback = actor.character.signature;
      } else this.feedback = shotById(shot).name;
    } else {
      shot = this.ai.plan.shot;
      aim = this.ai.plan.aim;
      error = this.ai.plan.error;
    }
    const signature =
      side === 0
        ? charge > 0.82 && (actor.character.id === "johnny" || mixed !== 0)
        : !this.coach && this.rally > 2 && this.rally % 8 === 3;
    if (signature && side === 1) {
      shot = actor.character.preferred;
      charge = 0.7;
      mixed = actor.character.tactic === "corners" ? 0.8 : 0;
    }
    const d = side === 0 ? -1 : 1;
    this.ball.p = { ...pos };
    strike(this.ball, d, {
      shot,
      aim,
      charge,
      mixed,
      error,
      spinSkill: actor.character.spinReading * (signature ? 1.18 : 1),
      power: actor.character.power * (signature ? 1.13 : 1),
      motion: actor.vx,
    });
    this.ball.p.y += d * 0.001;
    actor.animation =
      shot === "block"
        ? "block"
        : shot === "backhand" || shot === "back-loop"
          ? "backhand"
          : shot === "forehand" || shot === "fore-loop"
            ? "forehand"
            : pos.x > actor.x
              ? "forehand"
              : "backhand";
    actor.animTime = 0;
    this.landing = {
      side,
      shot,
      timing: side === 0 ? this.lastTiming : "GOOD",
    };
    this.lastShot = shotById(shot).name;
    this.rally++;
    this.bestRally = Math.max(this.bestRally, this.rally);
    this.emit({
      type: "hit",
      side,
      shot,
      text: signature ? actor.character.signature : undefined,
    });
  }
  private checkChallenge() {
    if (this.config.mode !== "challenge" || this.challengeDone) return;
    const key = this.config.challenge as keyof typeof this.stats | "rally";
    const value = this.stats[key] ?? 0;
    const goals: Record<string, number> = {
      rally: 8,
      spin: 6,
      perfect: 5,
      smash: 3,
      serve: SERVES.length,
    };
    if (value >= (goals[key] ?? 999)) {
      this.challengeDone = true;
      this.emit({ type: "challenge", text: "CHALLENGE COMPLETE" });
    }
  }
  point(side: Side, reason: string) {
    if (this.state !== "playing") return;
    this.ball.active = false;
    this.pending = undefined;
    this.rules.award(side);
    this.timer = 0;
    this.feedback =
      (side === 0 ? "YOUR POINT" : "OPPONENT POINT") + " · " + reason;
    this.players[side].animation = "victory";
    this.players[side].animTime = 0;
    this.players[side === 0 ? 1 : 0].animation = "miss";
    this.emit({ type: "point", side, text: reason });
    if (this.training || this.config.mode === "challenge") {
      this.state = "point";
      if (this.training && this.config.drill === "serves")
        this.rules.server = 0;
      return;
    }
    const winner = this.rules.winner();
    if (winner !== null) {
      this.state = "over";
      this.players[winner].animation = "victory";
      this.players[winner === 0 ? 1 : 0].animation = "defeat";
      this.emit({ type: "end", side: winner });
    } else this.state = "point";
  }
  pause() {
    this.paused = true;
    this.pending = undefined;
    this.accumulator = 0;
  }
  resume() {
    this.paused = false;
    this.accumulator = 0;
  }
  snapshot(): MatchSnapshot {
    return {
      config: this.config,
      score: [...this.rules.score],
      server: this.rules.server,
      initialServer: this.rules.initialServer,
      state: this.state,
      ball: copyBall(this.ball),
      players: this.players.map((p) => ({ x: p.x, y: p.y })),
      phase: this.rules.phase,
      lastHit: this.rules.lastHit,
      bounces: this.rules.bounces,
      touchedNet: this.rules.touchedNet,
      rally: this.rally,
      bestRally: this.bestRally,
      stats: { ...this.stats },
      timer: this.timer,
      clock: this.clock,
      rng: this.ai.rng.seed,
      serveStyle: this.serveStyle,
      served: [...this.served],
      returnRally: this.returnRally,
      landing: this.landing ? { ...this.landing } : undefined,
    };
  }
  static restore(s: MatchSnapshot) {
    if (
      !s ||
      !Array.isArray(s.score) ||
      s.score.length !== 2 ||
      s.score.some((v) => !Number.isInteger(v) || v < 0) ||
      !s.ball ||
      !s.players ||
      !["ready", "toss", "playing", "point"].includes(s.state)
    )
      throw new Error("Invalid match save");
    if (
      !s.config ||
      s.players.length !== 2 ||
      [s.ball.p, s.ball.v, s.ball.w].some(
        (v) => !v || ![v.x, v.y, v.z].every(Number.isFinite),
      ) ||
      s.players.some((p) => ![p.x, p.y].every(Number.isFinite))
    )
      throw new Error("Invalid saved coordinates");
    const m = new Match(s.config);
    m.rules.score = [...s.score];
    m.rules.server = s.server;
    m.rules.initialServer = s.initialServer;
    m.rules.phase = s.phase;
    m.rules.lastHit = s.lastHit;
    m.rules.bounces = s.bounces;
    m.rules.touchedNet = s.touchedNet;
    m.ball = copyBall(s.ball);
    m.state = s.state;
    m.timer = s.timer;
    m.clock = s.clock;
    m.rally = s.rally;
    m.bestRally = s.bestRally;
    m.stats = { ...m.stats, ...s.stats };
    m.returnRally = s.returnRally ?? 0;
    m.landing = s.landing ? { ...s.landing } : undefined;
    m.ai.rng.seed = s.rng;
    m.serveStyle = s.serveStyle;
    m.served = new Set(s.served);
    s.players.forEach((p, i) => {
      m.players[i].x = p.x;
      m.players[i].y = p.y;
    });
    m.pause();
    return m;
  }
}
