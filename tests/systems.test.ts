import { describe, it, expect } from "vitest";
import { Match } from "../src/game/physics/match";
import {
  DEFAULT_OPTIONS,
  freshSave,
  loadSave,
  saveProgress,
  unlockWin,
  type StorageLike,
} from "../src/game/data/save";
import { HEROES, OPPONENTS } from "../src/game/data/roster";
import { OpponentAI } from "../src/game/ai/opponent";
import { makeBall, vec, forecast } from "../src/game/physics/ball";
const store = (): StorageLike => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
};
const config = () => ({
  hero: "tony",
  opponent: "viktor",
  arena: 8,
  mode: "training" as const,
  options: { ...DEFAULT_OPTIONS },
  seed: 1982,
});
describe("durable local saves", () => {
  it("round trips options, story, unlocks and cosmetics", () => {
    const storage = store(),
      s = freshSave();
    s.options.leftHanded = true;
    unlockWin(s, 5, "chen", true);
    unlockWin(s, 6, "lin", true);
    s.outfit = 1;
    expect(saveProgress(storage, s)).toBe(true);
    expect(loadSave(storage)).toEqual(s);
  });
  it("recovers from malformed JSON and unsupported versions", () => {
    const storage = store();
    storage.setItem("spin-city-v1", "{");
    expect(loadSave(storage)).toEqual(freshSave());
    storage.setItem("spin-city-v1", '{"version":99}');
    expect(loadSave(storage)).toEqual(freshSave());
  });
  it("validates saved settings rather than allowing invalid physics or UI values", () => {
    const storage = store();
    storage.setItem(
      "spin-city-v1",
      JSON.stringify({
        ...freshSave(),
        story: 999,
        options: { volume: -5, zoneSize: 100, points: 1, difficulty: "CHEAT" },
      }),
    );
    const s = loadSave(storage);
    expect(s.story).toBe(12);
    expect(s.options.volume).toBe(0);
    expect(s.options.zoneSize).toBe(1.3);
    expect(s.options.points).toBe(5);
    expect(s.options.difficulty).toBe("ROOKIE");
  });
  it("handles storage denial without crashing the game", () => {
    const bad: StorageLike = {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
      removeItem: () => {},
    };
    expect(loadSave(bad)).toEqual(freshSave());
    expect(saveProgress(bad, freshSave())).toBe(false);
  });
});
describe("tactical opponents", () => {
  it("has 12 distinct tactical identities, not just speed changes", () => {
    expect(OPPONENTS).toHaveLength(12);
    expect(new Set(OPPONENTS.map((o) => o.tactic)).size).toBeGreaterThanOrEqual(
      10,
    );
    const ball = makeBall();
    ball.active = true;
    ball.p = vec(0.1, -0.2, 0.45);
    ball.v = vec(0.5, -4, 1);
    ball.w.x = 180;
    const plans = OPPONENTS.map((c) =>
      new OpponentAI(c, "PRO", 1982).update(0.1, ball, 0.4, 3),
    );
    expect(new Set(plans.map((p) => p.shot)).size).toBeGreaterThanOrEqual(6);
  });
  it("changes decision intervals by difficulty without changing ball physics", () => {
    const c = OPPONENTS[0],
      rookie = new OpponentAI(c, "ROOKIE"),
      legend = new OpponentAI(c, "LEGEND");
    const b = makeBall();
    rookie.update(0.1, b, 0, 0);
    legend.update(0.1, b, 0, 0);
    expect(rookie.timer).toBeGreaterThan(legend.timer);
  });
  it("heroes have different power and spin skills", () => {
    expect(HEROES[0].power).toBeGreaterThan(HEROES[1].power);
    expect(HEROES[0].spinReading).toBeLessThan(HEROES[1].spinReading);
  });
});
describe("real match simulation", () => {
  it("completes a legal serve and scores an unreturned ball", () => {
    const m = new Match(config());
    m.input({ shot: "flat", aim: 0, charge: 0, mixed: 0 });
    for (let i = 0; i < 1000 && m.rules.score[0] + m.rules.score[1] === 0; i++)
      m.update(1 / 120, { x: 0, y: 0 });
    expect(m.rules.score[0] + m.rules.score[1]).toBe(1);
    expect(m.rules.score[1]).toBe(1);
  });
  it("can sustain a rally through the actual swept paddle contacts", () => {
    const m = new Match(config());
    m.input({ shot: "flat", aim: 0, charge: 0, mixed: 0 });
    let maximum = 0;
    for (let i = 0; i < 4800; i++) {
      if (m.state === "ready" && m.rules.server === 0)
        m.input({ shot: "flat", aim: 0, charge: 0, mixed: 0 });
      if (
        m.state === "playing" &&
        m.ball.v.y > 0 &&
        m.rules.phase === "rally" &&
        m.rules.bounces > 0 &&
        !m.pending
      ) {
        const p = forecast(m.ball, m.playerPlane);
        if (p.time < 0.035)
          m.input({ shot: "block", aim: 0, charge: 0, mixed: 0 });
      }
      m.update(1 / 120, { x: 0, y: 0 });
      maximum = Math.max(maximum, m.rally);
    }
    expect(maximum).toBeGreaterThanOrEqual(8);
  });
  it("pauses every gameplay clock and resumes without catch-up jumps", () => {
    const m = new Match({ ...config(), mode: "quick" });
    m.input({ shot: "flat", aim: 0, charge: 0, mixed: 0 });
    m.update(0.1, { x: 0, y: 0 });
    m.pause();
    const snapshot = m.snapshot();
    m.update(5, { x: 1, y: 1 });
    expect(m.snapshot()).toEqual(snapshot);
    m.resume();
    m.update(1 / 120, { x: 0, y: 0 });
    expect(m.clock - snapshot.clock).toBeCloseTo(1 / 120);
  });
  it("restores a live match, score, spin, service and RNG in a paused state", () => {
    const m = new Match(config());
    m.input({ shot: "flat", aim: 0, charge: 0, mixed: 0 });
    for (let i = 0; i < 100; i++) m.update(1 / 120, { x: 0, y: 0 });
    const restored = Match.restore(JSON.parse(JSON.stringify(m.snapshot())));
    expect(restored.paused).toBe(true);
    expect(restored.snapshot()).toEqual(m.snapshot());
  });
  it("refuses invalid match snapshots", () => {
    expect(() => Match.restore({} as any)).toThrow();
  });
});
