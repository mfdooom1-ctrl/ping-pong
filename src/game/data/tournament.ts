import { Random } from "../ai/opponent";
import { character } from "./roster";
import { clamp } from "../physics/ball";
import { Rules } from "../physics/rules";
export interface BracketMatch {
  players: [string, string];
  score?: [number, number];
  winner?: string;
}
export interface BracketSave {
  rounds: BracketMatch[][];
  seed: number;
  hero: string;
}
export class Tournament {
  rounds: BracketMatch[][];
  rng: Random;
  constructor(
    public hero: string,
    seed = 1982,
  ) {
    this.rng = new Random(seed);
    const entrants = [
      "player",
      "marcus",
      "jack",
      "rico",
      "kenji",
      "chen",
      "dragan",
      "kim",
    ];
    this.rounds = [
      Array.from({ length: 4 }, (_, i) => ({
        players: [entrants[i * 2], entrants[i * 2 + 1]],
      })),
    ];
  }
  get round() {
    return Math.min(
      2,
      this.rounds.findIndex((r) =>
        r.some((m) => m.players.includes("player") && !m.winner),
      ) < 0
        ? this.rounds.length - 1
        : this.rounds.findIndex((r) =>
            r.some((m) => m.players.includes("player") && !m.winner),
          ),
    );
  }
  get champion() {
    return this.rounds[2]?.[0]?.winner;
  }
  opponent() {
    const pair = this.rounds[this.round].find(
      (m) => m.players.includes("player") && !m.winner,
    );
    if (!pair) throw new Error("Tournament has no pending player match");
    return pair.players.find((id) => id !== "player")!;
  }
  complete(score: [number, number], target: number) {
    const round = this.rounds[this.round];
    const pair = round.find((m) => m.players.includes("player") && !m.winner);
    if (!pair) throw new Error("Match already completed");
    const rules = new Rules(target);
    rules.score = [...score];
    const won = rules.winner();
    if (won === null) throw new Error("Unfinished tournament match");
    pair.score =
      pair.players[0] === "player" ? [...score] : [score[1], score[0]];
    pair.winner =
      won === 0 ? "player" : pair.players.find((id) => id !== "player")!;
    this.resolveOtherMatches(round, target);
    this.advance();
    if (won === 1) {
      while (!this.champion) {
        this.resolveOtherMatches(this.rounds[this.rounds.length - 1], target);
        this.advance();
      }
    }
  }
  private resolveOtherMatches(round: BracketMatch[], target: number) {
    for (const match of round) {
      if (match.winner) continue;
      if (match.players.includes("player")) continue;
      const [a, b] = match.players.map(character);
      const strength = (c: typeof a) =>
        c.accuracy * 0.4 +
        c.spinReading * 0.25 +
        c.power * 0.2 +
        c.footwork * 0.1 -
        c.reaction * 0.3;
      const chance = clamp(
        0.5 + (strength(a) - strength(b)) * 0.65,
        0.25,
        0.75,
      );
      const rules = new Rules(target);
      while (rules.winner() === null)
        rules.award(this.rng.next() < chance ? 0 : 1);
      match.score = [...rules.score];
      match.winner = match.players[rules.winner()!];
    }
  }
  private advance() {
    const last = this.rounds[this.rounds.length - 1];
    if (last.length > 1 && last.every((m) => m.winner))
      this.rounds.push(
        Array.from({ length: last.length / 2 }, (_, i) => ({
          players: [last[i * 2].winner!, last[i * 2 + 1].winner!],
        })),
      );
  }
  snapshot(): BracketSave {
    return {
      rounds: structuredClone(this.rounds),
      seed: this.rng.seed,
      hero: this.hero,
    };
  }
  static restore(save: BracketSave) {
    if (
      !save ||
      !Array.isArray(save.rounds) ||
      save.rounds.length < 1 ||
      save.rounds.length > 3 ||
      save.rounds.some(
        (r, i) =>
          !Array.isArray(r) ||
          r.length !== 4 / 2 ** i ||
          r.some((m) => !Array.isArray(m.players) || m.players.length !== 2),
      )
    )
      throw new Error("Invalid bracket save");
    const t = new Tournament(save.hero, save.seed);
    t.rounds = structuredClone(save.rounds);
    return t;
  }
}
