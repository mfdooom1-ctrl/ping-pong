import { describe, it, expect } from "vitest";
import {
  makeBall,
  stepBall,
  vec,
  copyBall,
  tableBounce,
  racketCrossing,
  forecast,
  type Collision,
} from "../src/game/physics/ball";
import { PHYSICS as P } from "../src/game/physics/config";
import {
  SERVES,
  serve,
  SHOTS,
  strike,
  timingFor,
  shotById,
} from "../src/game/data/shots";

function fly(b = makeBall(), seconds = 0.3) {
  b.active = true;
  for (let i = 0; i < seconds * 120; i++) stepBall(b);
  return b;
}
describe("2.5D ball flight", () => {
  it("uses gravity rather than a two-dimensional animation", () => {
    const b = makeBall();
    b.p = vec(2, 0, 2);
    fly(b, 0.2);
    expect(b.p.z).toBeLessThan(1.82);
    expect(b.v.z).toBeLessThan(-1.9);
  });
  it("loses horizontal speed to quadratic drag", () => {
    const b = makeBall();
    b.p = vec(2, 0, 2);
    b.v.x = 8;
    fly(b, 0.2);
    expect(b.v.x).toBeLessThan(8);
    expect(b.v.x).toBeGreaterThan(7);
  });
  it("topspin dips while backspin creates lift", () => {
    const top = makeBall();
    top.p = vec(2, 0, 2);
    top.v.y = -5;
    top.w.x = 250;
    const back = copyBall(top);
    back.w.x = -250;
    fly(top, 0.25);
    fly(back, 0.25);
    expect(top.p.z).toBeLessThan(back.p.z - 0.09);
  });
  it("opposite sidespin bends to opposite sides", () => {
    const left = makeBall();
    left.p = vec(0, 0, 2);
    left.v.y = -5;
    left.w.z = -250;
    const right = copyBall(left);
    right.w.z = 250;
    fly(left, 0.25);
    fly(right, 0.25);
    expect(left.p.x).toBeLessThan(-0.04);
    expect(right.p.x).toBeGreaterThan(0.04);
  });
  it("decays spin continuously", () => {
    const b = makeBall();
    b.p = vec(2, 0, 2);
    b.w.x = 200;
    fly(b, 0.2);
    expect(b.w.x).toBeLessThan(200);
    expect(b.w.x).toBeGreaterThan(180);
  });
  it("uses fixed steps deterministically", () => {
    const a = makeBall();
    a.p = vec(0, 1, 0.7);
    a.v = vec(0.2, -4, 2);
    a.active = true;
    const b = copyBall(a);
    for (let i = 0; i < 90; i++) stepBall(a);
    for (let frame = 0; frame < 45; frame++) {
      stepBall(b);
      stepBall(b);
    }
    expect(a).toEqual(b);
  });
});
describe("swept collisions and spin transfer", () => {
  it("does not tunnel through the table at high speed", () => {
    const b = makeBall();
    b.p = vec(0, 0.7, 0.12);
    b.v.z = -90;
    b.active = true;
    const events: Collision[] = [];
    stepBall(b, P.step, (c) => events.push(c));
    expect(events[0].type).toBe("table");
    expect(b.v.z).toBeGreaterThan(0);
    expect(b.p.z).toBeGreaterThan(P.radius);
  });
  it("retains a fraction of vertical energy", () => {
    const b = makeBall();
    b.v.z = -4;
    tableBounce(b);
    expect(b.v.z).toBeCloseTo(4 * P.restitution);
    expect(b.v.z ** 2).toBeLessThan(16);
  });
  it("transfers tangential angular momentum into the bounce", () => {
    const flat = makeBall();
    flat.v = vec(0, 3, -2);
    const top = copyBall(flat);
    top.w.x = -300;
    tableBounce(flat);
    tableBounce(top);
    expect(top.v.y).toBeGreaterThan(flat.v.y + 0.4);
    expect(Math.abs(top.w.x)).toBeLessThan(300);
  });
  it("backspin slows the bounce", () => {
    const flat = makeBall();
    flat.v = vec(0, 3, -2);
    const back = copyBall(flat);
    back.w.x = 200;
    tableBounce(flat);
    tableBounce(back);
    expect(back.v.y).toBeLessThan(flat.v.y);
  });
  it("sweeps the net even when crossing its full volume in one step", () => {
    const b = makeBall();
    b.p = vec(0, 0.2, 0.1);
    b.v.y = -70;
    b.active = true;
    const events: Collision[] = [];
    stepBall(b, P.step, (c) => events.push(c));
    expect(events.some((c) => c.type === "net")).toBe(true);
    expect(b.v.y).toBeGreaterThan(0);
  });
  it("clears the net when high enough", () => {
    const b = makeBall();
    b.p = vec(0, 0.1, 0.4);
    b.v.y = -30;
    b.active = true;
    const events: Collision[] = [];
    stepBall(b, P.step, (c) => events.push(c));
    expect(events.some((c) => c.type === "net")).toBe(false);
    expect(b.p.y).toBeLessThan(0);
  });
  it("resolves a softer table edge contact", () => {
    const b = makeBall();
    b.p = vec(P.halfWidth + 0.003, 0.6, 0.04);
    b.v.z = -6;
    b.active = true;
    const events: Collision[] = [];
    stepBall(b, P.step, (c) => events.push(c));
    expect(events[0].type).toBe("edge");
    expect(b.v.z).toBeLessThan(4);
  });
  it("does not bounce off empty space outside the table", () => {
    const b = makeBall();
    b.p = vec(1.2, 0.6, 0.04);
    b.v.z = -2;
    fly(b, 0.1);
    expect(b.p.z).toBeLessThan(0);
  });
  it("ends flight on the floor", () => {
    const b = makeBall();
    b.p = vec(2, 0, -0.7);
    b.v.z = -3;
    fly(b, 0.1);
    expect(b.active).toBe(false);
  });
  it("sweeps a moving paddle in relative coordinates", () => {
    expect(racketCrossing(vec(0, 1, 0), vec(0, 2, 0), 1.5, 1.6)).toBeCloseTo(
      0.5 / 0.9,
    );
    expect(racketCrossing(vec(0, 1, 0), vec(0, 1.1, 0), 1.5, 1.5)).toBeNull();
  });
  it("forecasts a real bounced trajectory without mutating the original", () => {
    const b = makeBall();
    serve(b, 0, "LONG", 0);
    const original = copyBall(b);
    const prediction = forecast(b, -1.43);
    expect(b).toEqual(original);
    expect(prediction.bounce).toBeDefined();
    expect(prediction.point.y).toBe(-1.43);
  });
});
describe("eight physically legal serves", () => {
  for (const side of [0, 1] as const)
    for (const style of SERVES)
      it(`${side} / ${style}: own half before receiver half`, () => {
        const b = makeBall();
        serve(b, side, style, 0);
        const hits: Collision[] = [];
        for (
          let i = 0;
          i < 240 &&
          hits.filter((c) => c.type === "table" || c.type === "edge").length <
            2 &&
          b.active;
          i++
        )
          stepBall(b, P.step, (c) => hits.push(c));
        expect(
          hits.filter((c) => c.type === "net"),
          JSON.stringify(hits),
        ).toHaveLength(0);
        const bounces = hits.filter(
          (c) => c.type === "table" || c.type === "edge",
        );
        expect(bounces, JSON.stringify(hits)).toHaveLength(2);
        expect(Math.sign(bounces[0].position.y)).toBe(side === 0 ? 1 : -1);
        expect(Math.sign(bounces[1].position.y)).toBe(side === 0 ? -1 : 1);
      });
});
describe("17 real stroke profiles", () => {
  it("gives every shot a distinct outgoing velocity and spin", () => {
    const results = SHOTS.map((s) => {
      const b = makeBall();
      b.p = vec(0, 1.43, 0.7);
      strike(b, -1, {
        shot: s.id,
        aim: 0.2,
        charge: 0,
        mixed: 0,
        error: 0,
        spinSkill: 1,
        power: 1,
        motion: 0,
      });
      return JSON.stringify({ v: b.v, w: b.w });
    });
    expect(new Set(results).size).toBe(17);
  });
  for (const shot of SHOTS)
    it(`${shot.name} reaches the opposite half with real flight`, () => {
      const b = makeBall();
      b.p = vec(0, 1.43, shot.id === "smash" ? 0.95 : 0.45);
      b.active = true;
      strike(b, -1, {
        shot: shot.id,
        aim: 0.12,
        charge: 0,
        mixed: 0,
        error: 0,
        spinSkill: 1,
        power: 1,
        motion: 0,
      });
      const hits: Collision[] = [];
      for (
        let i = 0;
        i < 200 && b.active && !hits.some((c) => c.type === "table");
        i++
      )
        stepBall(b, P.step, (c) => hits.push(c));
      expect(
        hits.some((c) => c.type === "net"),
        JSON.stringify(hits),
      ).toBe(false);
      const bounce = hits.find((c) => c.type === "table");
      expect(bounce, JSON.stringify(hits)).toBeDefined();
      expect(bounce!.position.y).toBeLessThan(0);
    });
  it("classifies timing and gives smash a narrower window", () => {
    expect(timingFor(0, shotById("smash"))).toBe("PERFECT");
    expect(timingFor(0.04, shotById("flat"))).toBe("PERFECT");
    expect(timingFor(0.07, shotById("flat"))).toBe("GOOD");
    expect(timingFor(-0.14, shotById("flat"))).toBe("EARLY");
    expect(timingFor(0.14, shotById("flat"))).toBe("LATE");
    expect(timingFor(0.12, shotById("smash"))).toBe("MISS");
  });
});
