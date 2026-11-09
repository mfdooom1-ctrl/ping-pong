import { ARENAS } from "../data/arenas";
import type { Options } from "../data/save";
// Original 16-step motifs, arranged with bass, arpeggio, hats, kick and snare.
const MOTIFS = [
  [0, 7, 12, 10, 7, 3, 5, 7, 0, 12, 15, 14, 10, 7, 5, 3],
  [0, 3, 7, 10, 12, 10, 7, 5, 3, 7, 15, 12, 10, 5, 7, 3],
  [0, 12, 7, 10, 3, 7, 5, 10, 12, 15, 14, 10, 7, 3, 2, 7],
  [0, 7, 10, 12, 15, 12, 10, 7, 5, 10, 12, 17, 15, 10, 7, 5],
  [0, 1, 7, 8, 12, 8, 7, 1, 0, 7, 13, 12, 8, 7, 1, 7],
  [0, 3, 5, 7, 10, 7, 5, 3, 0, 12, 10, 7, 5, 3, 5, 7],
  [0, 5, 7, 8, 7, 5, 3, 0, 3, 7, 12, 10, 8, 7, 5, 3],
  [0, 7, 5, 3, 0, 3, 7, 12, 10, 7, 5, 3, 2, 5, 7, 3],
  [0, 12, 7, 15, 12, 7, 3, 10, 0, 12, 17, 15, 10, 7, 3, 5],
  [0, 0, 7, 3, 0, 10, 7, 5, 0, 7, 12, 10, 7, 5, 3, 1],
  [0, 7, 12, 15, 14, 10, 7, 3, 5, 12, 17, 15, 14, 10, 7, 5],
  [0, 3, 10, 7, 12, 10, 5, 7, 0, 3, 15, 12, 10, 7, 5, 2],
  [0, 12, 7, 10, 12, 15, 14, 10, 0, 7, 5, 3, 5, 7, 12, 7],
];
export class Synth {
  context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private effectsBus?: GainNode;
  private loop?: ReturnType<typeof setInterval>;
  private noise?: AudioBuffer;
  private next = 0;
  private step = 0;
  private theme = -1;
  private rival = 0;
  private intensity = 0;
  private suspended = false;
  constructor(public options: Options) {}
  inspect() {
    return {
      state: this.context?.state ?? "uninitialized",
      time: this.context?.currentTime ?? 0,
      theme: this.theme,
      sequencerStep: this.step,
      music: this.options.music,
      effects: this.options.sfx,
    };
  }
  async unlock() {
    try {
      if (!this.context) {
        const Audio = window.AudioContext || (window as any).webkitAudioContext;
        this.context = new Audio({ latencyHint: "interactive" });
        const ctx = this.context!;
        this.master = ctx.createGain();
        this.master.connect(ctx.destination);
        this.musicBus = ctx.createGain();
        this.effectsBus = ctx.createGain();
        this.musicBus.connect(this.master);
        this.effectsBus.connect(this.master);
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const channel = this.noise.getChannelData(0);
        let seed = 1982;
        for (let i = 0; i < channel.length; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          channel[i] = (seed / 4294967296) * 2 - 1;
        }
      }
      this.suspended = false;
      await this.context.resume();
      this.apply();
      if (!this.loop) {
        this.next = this.context.currentTime + 0.05;
        this.loop = setInterval(() => this.schedule(), 35);
      }
    } catch {
      /* The next user gesture can retry audio if iOS initially refused it. */
    }
  }
  apply() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master!.gain.setTargetAtTime(this.options.volume * 0.52, t, 0.03);
    this.musicBus!.gain.setTargetAtTime(this.options.music ? 0.27 : 0, t, 0.03);
    this.effectsBus!.gain.setTargetAtTime(this.options.sfx ? 0.6 : 0, t, 0.03);
  }
  playTheme(arena = -1, rival = 0) {
    if (this.theme === arena && this.rival === rival) return;
    this.theme = arena;
    this.rival = rival;
    this.step = 0;
    if (this.context) this.next = this.context.currentTime + 0.06;
  }
  setIntensity(rally: number) {
    this.intensity = Math.min(1, rally / 12);
  }
  private tone(
    hz: number,
    time: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    bus?: GainNode,
    slide = 0,
  ) {
    const ctx = this.context;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, hz), time);
    if (slide)
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, hz + slide),
        time + duration,
      );
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  private drum(time: number, type: "kick" | "snare" | "hat", volume = 1) {
    const ctx = this.context;
    if (!ctx) return;
    if (type === "kick") {
      this.tone(135, time, 0.12, "sine", 0.8 * volume, this.musicBus, -100);
      return;
    }
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = this.noise!;
    filter.type = "highpass";
    filter.frequency.value = type === "hat" ? 7200 : 1100;
    gain.gain.setValueAtTime((type === "hat" ? 0.11 : 0.3) * volume, time);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      time + (type === "hat" ? 0.035 : 0.13),
    );
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    source.start(time);
    source.stop(time + 0.15);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    if (type === "snare")
      this.tone(180, time, 0.09, "triangle", 0.2 * volume, this.musicBus);
  }
  private schedule() {
    const ctx = this.context;
    if (!ctx || this.suspended || ctx.state !== "running") return;
    const arena = ARENAS[this.theme];
    const bpm = arena?.bpm ?? 140;
    const root = arena?.key ?? 45;
    const beat = 60 / bpm / 4;
    const motif =
      MOTIFS[(this.theme + 1 + this.rival) % MOTIFS.length] ?? MOTIFS[0];
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.02;
    while (this.next < ctx.currentTime + 0.14) {
      const n = this.step % 64,
        bar = Math.floor(this.step / 16) % 4,
        chord = [0, -3, 5, -5][bar];
      const freq = (note: number) => 440 * 2 ** ((note - 69) / 12);
      if (n % 4 === 0) this.drum(this.next, "kick");
      if (n % 8 === 4) this.drum(this.next, "snare");
      if (n % 2 === 0 || this.intensity > 0.7)
        this.drum(this.next, "hat", n % 2 === 0 ? 1 : 0.5);
      if (n % 2 === 0)
        this.tone(
          freq(root + chord + (n % 8 === 6 ? 7 : 0)),
          this.next,
          beat * 1.65,
          "triangle",
          0.32,
          this.musicBus,
        );
      if (n % 2 === 0 || bar === 3) {
        const note = motif[(n + bar * 3) % 16];
        this.tone(
          freq(root + 24 + note + chord),
          this.next,
          beat * 1.5,
          "square",
          0.075,
          this.musicBus,
        );
      }
      if (bar > 0)
        this.tone(
          freq(root + 12 + chord + [0, 7, 12, 7][n % 4]),
          this.next,
          beat * 0.7,
          "triangle",
          0.11 + this.intensity * 0.055,
          this.musicBus,
        );
      this.step++;
      this.next += beat;
    }
  }
  sfx(
    kind:
      | "hit"
      | "bounce"
      | "net"
      | "smash"
      | "spin"
      | "menu"
      | "point"
      | "win"
      | "lose"
      | "voice",
    power = 1,
  ) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || !this.options.sfx) return;
    const t = ctx.currentTime;
    if (kind === "hit")
      this.tone(
        460 + power * 120,
        t,
        0.065,
        "triangle",
        0.42,
        this.effectsBus,
        -280,
      );
    if (kind === "bounce")
      this.tone(730, t, 0.037, "sine", 0.3, this.effectsBus, -400);
    if (kind === "net")
      this.tone(105, t, 0.09, "triangle", 0.2, this.effectsBus, -50);
    if (kind === "smash") {
      this.tone(110, t, 0.17, "sawtooth", 0.23, this.effectsBus, -80);
      this.tone(960, t, 0.08, "square", 0.1, this.effectsBus, -700);
    }
    if (kind === "spin")
      this.tone(420, t, 0.095, "triangle", 0.16, this.effectsBus, 530);
    if (kind === "menu") {
      this.tone(660, t, 0.045, "square", 0.14, this.effectsBus);
      this.tone(990, t + 0.04, 0.07, "square", 0.1, this.effectsBus);
    }
    if (kind === "point") {
      [330, 440, 660].forEach((f, i) =>
        this.tone(f, t + i * 0.055, 0.1, "triangle", 0.2, this.effectsBus),
      );
      this.crowd(t + 0.1);
    }
    if (kind === "win" || kind === "lose") {
      const notes =
        kind === "win" ? [0, 4, 7, 12, 7, 12, 16, 19] : [7, 6, 3, 0, -5];
      notes.forEach((note, i) =>
        this.tone(
          261.63 * 2 ** (note / 12),
          t + i * 0.13,
          0.2,
          "square",
          0.13,
          this.effectsBus,
        ),
      );
      if (kind === "win") this.crowd(t + 0.2);
    }
    if (kind === "voice")
      [350, 245, 390, 270, 210].forEach((f, i) =>
        this.tone(f, t + i * 0.055, 0.055, "sawtooth", 0.07, this.effectsBus),
      );
  }
  private crowd(t: number) {
    const ctx = this.context;
    if (!ctx || !this.noise) return;
    for (let i = 0; i < 4; i++) {
      const s = ctx.createBufferSource(),
        f = ctx.createBiquadFilter(),
        g = ctx.createGain();
      s.buffer = this.noise;
      f.type = "bandpass";
      f.frequency.value = 700 + i * 430;
      g.gain.setValueAtTime(0.035, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 + i * 0.07);
      s.connect(f);
      f.connect(g);
      g.connect(this.effectsBus!);
      s.start(t + i * 0.07);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        g.disconnect();
      };
    }
  }
  suspend() {
    this.suspended = true;
    if (this.loop) {
      clearInterval(this.loop);
      this.loop = undefined;
    }
    void this.context?.suspend();
  }
}
