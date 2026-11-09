import { PHYSICS as P } from "./config";
export interface V3 {
  x: number;
  y: number;
  z: number;
}
export interface Ball {
  p: V3;
  v: V3;
  w: V3;
  active: boolean;
}
export type Surface = "table" | "edge" | "net" | "floor";
export interface Collision {
  type: Surface;
  position: V3;
}
export const vec = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const makeBall = (): Ball => ({
  p: vec(0, 1.6, 0.4),
  v: vec(),
  w: vec(),
  active: false,
});
export const copyBall = (b: Ball): Ball => ({
  p: { ...b.p },
  v: { ...b.v },
  w: { ...b.w },
  active: b.active,
});
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (n: number, a: number, b: number) =>
  Math.min(b, Math.max(a, n));

export function accelerate(b: Ball, dt: number) {
  const { v, w } = b;
  const speed = Math.hypot(v.x, v.y, v.z);
  const drag = P.drag * speed;
  const ax = P.magnus * (w.y * v.z - w.z * v.y) - drag * v.x;
  const ay = P.magnus * (w.z * v.x - w.x * v.z) - drag * v.y;
  const az = P.magnus * (w.x * v.y - w.y * v.x) - P.gravity - drag * v.z;
  v.x += ax * dt;
  v.y += ay * dt;
  v.z += az * dt;
  const decay = Math.exp(-P.spinDecay * dt);
  w.x *= decay;
  w.y *= decay;
  w.z *= decay;
}

export function tableBounce(b: Ball, edge = false) {
  b.v.z = Math.abs(b.v.z) * (edge ? P.edgeRestitution : P.restitution);
  // Tangential contact velocity includes the bottom point of the spinning sphere.
  const impulseX = -P.friction * (b.v.x - P.radius * b.w.y);
  const impulseY = -P.friction * (b.v.y + P.radius * b.w.x);
  b.v.x += impulseX;
  b.v.y += impulseY;
  b.w.y -= impulseX / (0.4 * P.radius);
  b.w.x += impulseY / (0.4 * P.radius);
}

/** Swept time-of-impact contacts, including multiple surfaces within a fixed tick. */
export function stepBall(
  b: Ball,
  dt = P.step,
  notify?: (c: Collision) => void,
) {
  if (!b.active) return;
  accelerate(b, dt);
  let remaining = dt;
  for (
    let contacts = 0;
    remaining > 1e-7 && contacts < 5 && b.active;
    contacts++
  ) {
    const start = { ...b.p };
    const end = vec(
      start.x + b.v.x * remaining,
      start.y + b.v.y * remaining,
      start.z + b.v.z * remaining,
    );
    let hit = 1.00001;
    let surface: Surface | undefined;
    if (start.z >= P.radius - 1e-6 && end.z < P.radius && b.v.z < 0) {
      const t = (start.z - P.radius) / (start.z - end.z);
      const x = lerp(start.x, end.x, t),
        y = lerp(start.y, end.y, t);
      if (
        Math.abs(x) <= P.halfWidth + P.radius * 0.55 &&
        Math.abs(y) <= P.halfLength + P.radius * 0.55
      ) {
        hit = t;
        surface =
          Math.abs(x) > P.halfWidth - P.radius * 0.35 ||
          Math.abs(y) > P.halfLength - P.radius * 0.35
            ? "edge"
            : "table";
      }
    }
    // A thin net volume is swept from both sides, preventing fast-ball tunnelling.
    const side = Math.sign(start.y) || -Math.sign(b.v.y);
    const plane = side * (P.radius + 0.004);
    if ((start.y - plane) * side >= 0 && (end.y - plane) * side < 0) {
      const t = (start.y - plane) / (start.y - end.y);
      const z = lerp(start.z, end.z, t),
        x = lerp(start.x, end.x, t);
      if (
        t < hit &&
        z < P.netHeight + P.radius &&
        z > -P.radius &&
        Math.abs(x) < P.halfWidth + 0.075
      ) {
        hit = t;
        surface = "net";
      }
    }
    if (end.z < P.floor + P.radius && b.v.z < 0) {
      const t = Math.max(0, (start.z - P.floor - P.radius) / (start.z - end.z));
      if (t < hit) {
        hit = t;
        surface = "floor";
      }
    }
    if (!surface) {
      b.p = end;
      break;
    }
    b.p = vec(
      lerp(start.x, end.x, hit),
      lerp(start.y, end.y, hit),
      lerp(start.z, end.z, hit),
    );
    if (surface === "table" || surface === "edge") {
      b.p.z = P.radius + 1e-6;
      tableBounce(b, surface === "edge");
    }
    if (surface === "net") {
      b.v.y *= -P.netRestitution;
      b.v.x *= 0.62;
      b.v.z -= 0.28;
      b.w.x *= 0.65;
      b.p.y += side * 0.001;
    }
    if (surface === "floor") {
      b.active = false;
    }
    notify?.({ type: surface, position: { ...b.p } });
    remaining *= 1 - hit;
  }
}

/** Cross the moving racket plane using relative swept motion. */
export function racketCrossing(
  a: V3,
  b: V3,
  oldY: number,
  newY: number,
): number | null {
  const da = a.y - oldY,
    db = b.y - newY;
  if (da * db > 0 || Math.abs(da - db) < 1e-10) return null;
  return clamp(da / (da - db), 0, 1);
}

export function forecast(ball: Ball, contactY: number, limit = 1.8) {
  const b = copyBall(ball);
  let bounce: V3 | undefined;
  for (let t = 0; t < limit && b.active; t += P.step) {
    const old = { ...b.p };
    stepBall(b, P.step, (c) => {
      if ((c.type === "table" || c.type === "edge") && !bounce)
        bounce = c.position;
    });
    const ratio = racketCrossing(old, b.p, contactY, contactY);
    if (ratio !== null && t > 0)
      return {
        point: vec(
          lerp(old.x, b.p.x, ratio),
          contactY,
          lerp(old.z, b.p.z, ratio),
        ),
        time: t + ratio * P.step,
        bounce,
      };
  }
  return { point: { ...b.p }, time: limit, bounce };
}
