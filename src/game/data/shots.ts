import { clamp, vec, type Ball } from "../physics/ball";
export type ShotId =
  | "flat"
  | "topspin"
  | "backspin"
  | "side-left"
  | "side-right"
  | "forehand"
  | "backhand"
  | "fore-loop"
  | "back-loop"
  | "push"
  | "block"
  | "flick"
  | "smash"
  | "lob"
  | "drop"
  | "counter"
  | "save";
export interface Shot {
  id: ShotId;
  name: string;
  flight: number;
  depth: number;
  top: number;
  side: number;
  power: number;
  window: number;
  height: number;
}
export const SHOTS: Shot[] = [
  {
    id: "flat",
    name: "FLAT DRIVE",
    flight: 0.59,
    depth: 0.91,
    top: 10,
    side: 0,
    power: 1,
    window: 0.18,
    height: 0,
  },
  {
    id: "topspin",
    name: "TOPSPIN",
    flight: 0.57,
    depth: 1.02,
    top: 255,
    side: 0,
    power: 1.08,
    window: 0.14,
    height: 0.05,
  },
  {
    id: "backspin",
    name: "CHOP",
    flight: 0.72,
    depth: 0.82,
    top: -220,
    side: 0,
    power: 0.85,
    window: 0.18,
    height: 0,
  },
  {
    id: "side-left",
    name: "SIDESPIN LEFT",
    flight: 0.65,
    depth: 0.9,
    top: 30,
    side: -230,
    power: 0.95,
    window: 0.16,
    height: 0.03,
  },
  {
    id: "side-right",
    name: "SIDESPIN RIGHT",
    flight: 0.65,
    depth: 0.9,
    top: 30,
    side: 230,
    power: 0.95,
    window: 0.16,
    height: 0.03,
  },
  {
    id: "forehand",
    name: "FOREHAND DRIVE",
    flight: 0.54,
    depth: 1.06,
    top: 70,
    side: 25,
    power: 1.12,
    window: 0.14,
    height: 0,
  },
  {
    id: "backhand",
    name: "BACKHAND DRIVE",
    flight: 0.58,
    depth: 0.96,
    top: 85,
    side: -20,
    power: 1.02,
    window: 0.16,
    height: 0,
  },
  {
    id: "fore-loop",
    name: "FOREHAND LOOP",
    flight: 0.6,
    depth: 1.13,
    top: 380,
    side: 30,
    power: 1.15,
    window: 0.1,
    height: 0.1,
  },
  {
    id: "back-loop",
    name: "BACKHAND LOOP",
    flight: 0.64,
    depth: 1.03,
    top: 330,
    side: -30,
    power: 1.03,
    window: 0.12,
    height: 0.08,
  },
  {
    id: "push",
    name: "PUSH",
    flight: 0.82,
    depth: 0.36,
    top: -155,
    side: 0,
    power: 0.65,
    window: 0.19,
    height: 0,
  },
  {
    id: "block",
    name: "BLOCK",
    flight: 0.62,
    depth: 0.87,
    top: 0,
    side: 0,
    power: 0.8,
    window: 0.21,
    height: 0,
  },
  {
    id: "flick",
    name: "FLICK",
    flight: 0.48,
    depth: 0.75,
    top: 155,
    side: 55,
    power: 1.1,
    window: 0.1,
    height: 0.02,
  },
  {
    id: "smash",
    name: "SMASH",
    flight: 0.36,
    depth: 1.15,
    top: 95,
    side: 0,
    power: 1.45,
    window: 0.085,
    height: 0,
  },
  {
    id: "lob",
    name: "LOB",
    flight: 1.3,
    depth: 1.05,
    top: 100,
    side: 0,
    power: 0.78,
    window: 0.2,
    height: 0.25,
  },
  {
    id: "drop",
    name: "DROP SHOT",
    flight: 0.86,
    depth: 0.24,
    top: -90,
    side: 55,
    power: 0.55,
    window: 0.115,
    height: 0,
  },
  {
    id: "counter",
    name: "COUNTERSPIN",
    flight: 0.51,
    depth: 1.11,
    top: 300,
    side: 0,
    power: 1.2,
    window: 0.09,
    height: 0.04,
  },
  {
    id: "save",
    name: "EMERGENCY SAVE",
    flight: 1.05,
    depth: 0.78,
    top: -40,
    side: -50,
    power: 0.7,
    window: 0.24,
    height: 0.18,
  },
];
export const shotById = (id: ShotId) => SHOTS.find((s) => s.id === id)!;
export type Timing = "PERFECT" | "GOOD" | "LATE" | "EARLY" | "MISS";
export function timingFor(error: number, shot: Shot): Timing {
  if (Math.abs(error) < shot.window * 0.23) return "PERFECT";
  if (Math.abs(error) < shot.window * 0.63) return "GOOD";
  if (Math.abs(error) <= shot.window) return error < 0 ? "EARLY" : "LATE";
  return "MISS";
}
export interface Stroke {
  shot: ShotId;
  aim: number;
  charge: number;
  mixed: number;
  error: number;
  spinSkill: number;
  power: number;
  motion: number;
}
export function strike(ball: Ball, direction: number, s: Stroke) {
  const shot = shotById(s.shot);
  const incoming = { ...ball.v },
    oldSpin = { ...ball.w };
  const charge = clamp(s.charge, 0, 1);
  const time = shot.flight / (1 + charge * 0.12 + (s.power - 1) * 0.16);
  const targetY = direction * shot.depth;
  const targetX = clamp(s.aim, -0.66, 0.66);
  const top = shot.top * s.spinSkill;
  const side = (shot.side + s.mixed * 220) * s.spinSkill;
  ball.w = vec(-direction * top, side * 0.15, side);
  if (s.shot === "counter") ball.w.x -= oldSpin.x * 0.34;
  if (s.shot === "block") {
    ball.w.x = oldSpin.x * 0.25;
    ball.w.z = oldSpin.z * 0.2;
  }
  const vy = (targetY - ball.p.y) / time;
  // Magnus acceleration changes flight, rather than merely decorating the ball trail.
  const az = -9.81 + 0.00165 * ball.w.x * vy;
  const ax = -0.00165 * ball.w.z * vy;
  const spinMisread = (1 - s.spinSkill * 0.7) * 0.0014;
  ball.v.y = vy * (1 + 0.025 * shot.power);
  ball.v.x =
    (targetX - ball.p.x - 0.5 * ax * time * time) / time +
    s.motion * 0.16 +
    oldSpin.z * spinMisread;
  ball.v.z = (0.02 - ball.p.z - 0.5 * az * time * time) / time + shot.height;
  // Incoming underspin punishes an unadjusted flat face; loops and chops compensate.
  if (s.shot === "flat" || s.shot === "forehand" || s.shot === "backhand")
    ball.v.z += Math.sign(direction) * oldSpin.x * spinMisread * 0.6;
  if (s.shot === "block") ball.v.y += incoming.y * 0.09;
  const error = s.error / shot.window;
  ball.v.x += error * 0.32;
  ball.v.z -= Math.abs(error) * 0.14;
}
export const SERVES = [
  "SHORT",
  "LONG",
  "FAST",
  "PENDULUM",
  "BACKSPIN",
  "TOPSPIN",
  "SIDESPIN",
  "MIXED",
] as const;
export type ServeId = (typeof SERVES)[number];
export function serve(
  ball: Ball,
  side: 0 | 1,
  style: ServeId,
  x: number,
  spinSkill = 1,
) {
  const d = side === 0 ? -1 : 1;
  const speed =
    style === "FAST"
      ? 4.8
      : style === "SHORT"
        ? 3
        : style === "LONG"
          ? 4.1
          : 3.65;
  const top =
    style === "TOPSPIN"
      ? 180
      : style === "BACKSPIN" || style === "SHORT"
        ? -145
        : style === "MIXED"
          ? 110
          : 0;
  const lateral =
    style === "PENDULUM"
      ? -230
      : style === "SIDESPIN"
        ? 230
        : style === "MIXED"
          ? 175
          : 0;
  ball.p = vec(clamp(x, -0.55, 0.55), -d * 1.31, 0.32);
  ball.v = vec(lateral * -0.001, d * speed, -0.72);
  ball.w = vec(-d * top * spinSkill, 0, lateral * spinSkill);
  ball.active = true;
}
