import { describe, it, expect } from "vitest";
import { Rules } from "../src/game/physics/rules";
describe("table tennis service and scoring", () => {
  it("requires both service bounces", () => {
    const r = new Rules();
    r.begin();
    expect(r.bounce(0)).toBeNull();
    expect(r.phase).toBe("receiver-bounce");
    expect(r.bounce(1)).toBeNull();
    expect(r.phase).toBe("rally");
    expect(r.hit(1)).toBeNull();
  });
  it("faults a serve that misses the server half", () => {
    const r = new Rules();
    r.begin();
    expect(r.bounce(1)).toBe(1);
  });
  it("faults a serve with two bounces on the server half", () => {
    const r = new Rules();
    r.begin();
    r.bounce(0);
    expect(r.bounce(0)).toBe(1);
  });
  it("replays a legal net serve without adding points", () => {
    const r = new Rules();
    r.begin();
    r.bounce(0);
    r.net();
    expect(r.bounce(1)).toBe("let");
    expect(r.score).toEqual([0, 0]);
  });
  it("does not call a net serve a let before it lands legally", () => {
    const r = new Rules();
    r.begin();
    r.bounce(0);
    r.net();
    expect(r.out()).toBe(1);
  });
  it("awards a double bounce to the last hitter", () => {
    const r = new Rules();
    r.begin();
    r.bounce(0);
    r.bounce(1);
    expect(r.bounce(1)).toBe(0);
  });
  it("rejects a volley before the required bounce", () => {
    const r = new Rules();
    r.phase = "rally";
    r.lastHit = 0;
    r.bounces = 0;
    expect(r.hit(1)).toBe(0);
  });
  it("rejects hitting your own ball twice", () => {
    const r = new Rules();
    r.phase = "rally";
    r.lastHit = 0;
    r.bounces = 1;
    expect(r.hit(0)).toBe(1);
  });
  it("distinguishes a long shot from an unreturned legal bounce", () => {
    const r = new Rules();
    r.phase = "rally";
    r.lastHit = 0;
    expect(r.out()).toBe(1);
    r.bounces = 1;
    expect(r.out()).toBe(0);
  });
  it("switches service after every two points", () => {
    const r = new Rules();
    r.award(0);
    expect(r.server).toBe(0);
    r.award(1);
    expect(r.server).toBe(1);
    r.award(0);
    r.award(0);
    expect(r.server).toBe(0);
  });
  for (const target of [5, 7, 11])
    it(`plays ${target} with win-by-two and deuce service`, () => {
      const r = new Rules(target);
      for (let i = 0; i < target - 1; i++) {
        r.award(0);
        r.award(1);
      }
      expect(r.winner()).toBeNull();
      const server = r.server;
      r.award(0);
      expect(r.winner()).toBeNull();
      expect(r.server).not.toBe(server);
      r.award(1);
      expect(r.server).toBe(server);
      r.award(1);
      r.award(1);
      expect(r.winner()).toBe(1);
    });
});
