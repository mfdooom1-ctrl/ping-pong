/** SI units. The table top is z=0; the floor is z=-0.76. */
export const PHYSICS = Object.freeze({
  step: 1 / 120,
  gravity: 9.81,
  radius: 0.02,
  drag: 0.014,
  magnus: 0.00165,
  spinDecay: 0.19,
  restitution: 0.89,
  friction: 0.105,
  edgeRestitution: 0.57,
  netRestitution: 0.17,
  halfWidth: 0.7625,
  halfLength: 1.37,
  netHeight: 0.1525,
  floor: -0.76,
  paddleReach: 0.29,
  paddleHeight: 1.34,
});

/** Assistance changes positioning and intent timing, never the physical ball radius. */
export const ASSIST = {
  EASY: { buffer: 0.62, timing: 0.42, speed: 1.3, tracking: 12, pace: 0.82 },
  PRO: { buffer: 0.32, timing: 0.24, speed: 1, tracking: 8, pace: 1 },
  MANUAL: { buffer: 0.2, timing: 0.18, speed: 0, tracking: 6, pace: 1 },
} as const;
