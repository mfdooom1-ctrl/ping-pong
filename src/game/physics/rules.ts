export type Side = 0 | 1;
export const other = (side: Side): Side => (side === 0 ? 1 : 0);
export type RallyPhase = "own-bounce" | "receiver-bounce" | "rally";
export class Rules {
  score: [number, number] = [0, 0];
  initialServer: Side = 0;
  server: Side = 0;
  lastHit: Side = 0;
  phase: RallyPhase = "own-bounce";
  bounces = 0;
  touchedNet = false;
  constructor(public target = 11) {}
  begin() {
    this.lastHit = this.server;
    this.phase = "own-bounce";
    this.bounces = 0;
    this.touchedNet = false;
  }
  net() {
    this.touchedNet = true;
  }
  bounce(side: Side): Side | "let" | null {
    if (this.phase === "own-bounce") {
      if (side !== this.server) return other(this.server);
      this.phase = "receiver-bounce";
      return null;
    }
    if (this.phase === "receiver-bounce") {
      if (side === this.server) return other(this.server);
      if (this.touchedNet) return "let";
      this.phase = "rally";
      this.bounces = 1;
      return null;
    }
    if (side === this.lastHit) return other(this.lastHit);
    this.bounces++;
    return this.bounces >= 2 ? this.lastHit : null;
  }
  hit(side: Side): Side | null {
    if (this.phase !== "rally" || this.bounces === 0 || side === this.lastHit)
      return other(side);
    this.lastHit = side;
    this.bounces = 0;
    this.touchedNet = false;
    return null;
  }
  out(): Side {
    return this.phase === "rally" && this.bounces > 0
      ? this.lastHit
      : other(this.lastHit);
  }
  award(side: Side) {
    this.score[side]++;
    const total = this.score[0] + this.score[1];
    const deuce =
      this.score[0] >= this.target - 1 && this.score[1] >= this.target - 1;
    const turn = deuce
      ? total - 2 * (this.target - 1) + this.target - 1
      : Math.floor(total / 2);
    this.server = ((this.initialServer + turn) % 2) as Side;
  }
  winner(): Side | null {
    const [a, b] = this.score;
    return Math.max(a, b) >= this.target && Math.abs(a - b) >= 2
      ? a > b
        ? 0
        : 1
      : null;
  }
}
