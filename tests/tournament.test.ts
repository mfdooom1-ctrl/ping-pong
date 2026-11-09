import { it, expect } from "vitest";
import { Tournament } from "../src/game/data/tournament";
it("advances actual winners through an eight-player bracket", () => {
  const t = new Tournament("johnny", 1982);
  expect(t.opponent()).toBe("marcus");
  t.complete([5, 3], 5);
  expect(t.round).toBe(1);
  expect(t.rounds[0].every((m) => !!m.winner && !!m.score)).toBe(true);
  expect(t.opponent()).toBe(t.rounds[0][1].winner);
  t.complete([7, 5], 5);
  expect(t.round).toBe(2);
  expect(t.opponent()).toBe(t.rounds[1][1].winner);
  t.complete([11, 9], 11);
  expect(t.champion).toBe("player");
});
it("simulates all remaining AI games after player elimination", () => {
  const t = new Tournament("tony");
  t.complete([2, 5], 5);
  expect(t.champion).toBeDefined();
  expect(t.champion).not.toBe("player");
  expect(
    t.rounds
      .flat()
      .every(
        (m) => m.winner && m.score && Math.abs(m.score[0] - m.score[1]) >= 2,
      ),
  ).toBe(true);
});
it("restores the entire bracket and seeded AI results", () => {
  const a = new Tournament("tony");
  a.complete([5, 0], 5);
  const b = Tournament.restore(JSON.parse(JSON.stringify(a.snapshot())));
  expect(b.snapshot()).toEqual(a.snapshot());
  a.complete([5, 3], 5);
  b.complete([5, 3], 5);
  expect(a.snapshot()).toEqual(b.snapshot());
});
it("rejects incomplete scores and malformed bracket saves", () => {
  const t = new Tournament("johnny");
  expect(() => t.complete([4, 4], 5)).toThrow();
  expect(() => Tournament.restore({ rounds: [] } as any)).toThrow();
});
