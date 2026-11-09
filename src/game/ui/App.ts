import { ArcadeScene } from "../scenes/ArcadeScene";
import { Controls } from "../input/controls";
import {
  Match,
  type MatchConfig,
  type MatchEvent,
  type Mode,
} from "../physics/match";
import { ARENAS, CHALLENGES, STORY_ARENAS, STORY_ORDER } from "../data/arenas";
import { HEROES, OPPONENTS, ROSTER, character } from "../data/roster";
import { SHOTS, SERVES, type ShotId } from "../data/shots";
import {
  browserStorage,
  loadSave,
  saveProgress,
  unlockWin,
  type Options,
} from "../data/save";
import { Synth } from "../audio/synth";
import { Tournament } from "../data/tournament";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const MATCH_KEY = "spin-city-match-v1";
export class App {
  storage = browserStorage();
  save = loadSave(this.storage);
  audio = new Synth(this.save.options);
  match?: Match;
  controls?: Controls;
  private view = "home";
  private arena = 0;
  private opponent = 6;
  private drill = "free";
  private challenge = "rally";
  private tournamentRound = 0;
  private ui = document.getElementById("ui")!;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private clock = 0;
  private hudClock = 0;
  private debug = location.search.includes("debug");
  private shot: ShotId = "flat";
  private fromPause = false;
  private timingUntil = 0;
  private tour = new Tournament(this.save.hero);
  constructor(public scene: ArcadeScene) {
    this.ui.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!b || b.getAttribute("disabled") !== null) return;
      void this.audio.unlock();
      this.audio.sfx("menu");
      this.action(b.dataset.action!, b.dataset.value ?? "");
    });
    this.ui.addEventListener("input", (e) => this.option(e));
    this.ui.addEventListener("change", (e) => {
      if ((e.target as HTMLElement).tagName === "SELECT") this.option(e);
    });
    const pause = () => {
      if (this.match && this.match.state !== "over") this.pause();
      this.audio.suspend();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pause();
    });
    window.addEventListener("pagehide", pause);
    window.addEventListener("blur", pause);
    window.addEventListener("resize", () => {
      if (innerHeight > innerWidth && innerWidth < 900 && this.match)
        this.pause();
    });
    window.addEventListener("keydown", (e) => {
      if (e.code === "Backquote") {
        this.debug = !this.debug;
        document
          .getElementById("debug")
          ?.classList.toggle("hidden", !this.debug);
      }
    });
    scene.onFrame = (m, delta) => this.frame(m, delta);
    this.home();
    (window as any).__SPIN_CITY__ = {
      getState: () =>
        this.match
          ? {
              ...this.match.snapshot(),
              paused: this.match.paused,
              input: { x: this.controls?.x ?? 0, y: this.controls?.y ?? 0 },
              ai: { ...this.match.ai.plan },
            }
          : { state: "menu" },
      getAudioState: () => this.audio.inspect(),
      version: "1.0.0",
    };
  }
  private persist() {
    if (!saveProgress(this.storage, this.save))
      this.toast("Storage is full. This session still works.");
  }
  toast(text: string) {
    const t = document.getElementById("toast")!;
    t.textContent = text;
    t.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove("visible"), 3200);
  }
  private header(title: string, kicker = "THE UNDERGROUND WORLD TOUR") {
    return `<header class="panel-header"><div><span class="eyebrow">${kicker}</span><h2>${title}</h2></div><button class="icon-button" data-action="back" aria-label="Back">&lt;</button></header>`;
  }
  private footer() {
    return `<footer class="screen-footer"><span><i class="status-dot"></i> LOCAL / OFFLINE READY</span><span>VOL. 01 · EST. 1982</span></footer>`;
  }
  home() {
    this.controls?.destroy();
    this.controls = undefined;
    this.match = undefined;
    this.view = "home";
    this.fromPause = false;
    this.scene.home();
    this.audio.playTheme(-1);
    let resume = false;
    try {
      resume = !!this.storage.getItem(MATCH_KEY);
    } catch {}
    this.ui.innerHTML = `<section class="home screen"><div class="topline"><span class="wordmark">SC<span> / </span>ARCADE CLUB</span><button class="quiet" data-action="install">INSTALL ↗</button></div><div class="home-copy"><span class="eyebrow">TWO MUSTACHES. ONE WORLD TITLE.</span><h1>SPIN<br><span>CITY</span><i class="title-ball"></i></h1><div class="subtitle">PING-PONG</div><p class="tagline">Big hair. Bad company. Wicked spin.</p><div class="start-row"><button class="start-button" data-action="setup">START GAME <span>▶</span></button>${resume ? '<button class="resume-link" data-action="restore">CONTINUE SAVED MATCH →</button>' : ""}</div><nav class="home-nav"><button data-action="story">STORY <small>${Math.min(this.save.story, 12)}/12</small></button><button data-action="training">TRAINING</button><button data-action="characters">CHARACTERS</button><button data-action="options">OPTIONS</button></nav></div><div class="hero-name johnny"><span>01 / POWER</span><strong>JOHNNY</strong><small>“THE MUSTACHE”</small></div><div class="hero-name tony"><span>02 / SPIN</span><strong>TONY</strong><small>“THE SPIN”</small></div><div class="title-features"><span>12 CITIES</span><b>×</b><span>17 SHOTS</span><b>×</b><span>PURE ARCADE</span></div>${this.footer()}</section>`;
  }
  private setup() {
    this.view = "setup";
    this.scene.previewArena(this.arena);
    const hero = character(this.save.hero);
    this.ui.innerHTML = `<section class="screen panel setup">${this.header("MAKE YOUR ENTRANCE", "QUICK MATCH / SELECT YOUR NIGHT")}<div class="setup-grid"><div class="hero-pick"><span class="eyebrow">01 / YOUR PLAYER</span><div class="hero-choice"><button data-action="hero" data-value="johnny" class="${hero.id === "johnny" ? "selected" : ""}"><img src="${this.asset("portrait-johnny.png")}" alt="Johnny: long hair, white headband, mustache and USA jersey"><strong>JOHNNY</strong><small>POWER +++</small></button><button data-action="hero" data-value="tony" class="${hero.id === "tony" ? "selected" : ""}"><img src="${this.asset("portrait-tony.png")}" alt="Tony: dark curls, mustache and striped polo"><strong>TONY</strong><small>SPIN +++</small></button></div><p class="micro">${hero.signature}<br>${hero.id === "johnny" ? "Attack hard. Risk everything." : "Bend the ball. Keep your cool."}</p><button class="text-link" data-action="characters">THE FULL ROSTER →</button></div><div class="arena-pick"><span class="eyebrow">02 / THE VENUE</span><div class="arena-grid">${ARENAS.map((a, i) => `<button class="arena-card ${this.arena === i ? "selected" : ""} ${this.save.arenas.includes(i) ? "" : "locked"}" data-action="arena" data-value="${i}" style="--arena:#${a.glow.toString(16).padStart(6, "0")};--sky:#${a.sky.toString(16)}"><div class="mini-city decor-${a.decor}"><i></i><b></b></div><span>${a.name.replace(" CHAMPIONSHIP", "").replace("HONG KONG ", "HK ").replace(" SPORTS HALL", " HALL")}</span>${this.save.arenas.includes(i) ? "" : "<em>STORY UNLOCK</em>"}</button>`).join("")}</div></div><div class="match-pick"><span class="eyebrow">03 / THE OPPOSITION</span><label>RIVAL<select id="rival-select">${OPPONENTS.map((c, i) => `<option value="${i}" ${i === this.opponent ? "selected" : ""}>${c.nick}</option>`).join("")}</select></label><div class="rival-info"><img src="${this.asset("portrait-" + OPPONENTS[this.opponent].id + ".png")}" alt="${OPPONENTS[this.opponent].name}"><span>${OPPONENTS[this.opponent].country}<strong>${OPPONENTS[this.opponent].tactic.toUpperCase()}</strong></span></div><label>DIFFICULTY<select data-option="difficulty">${["ROOKIE", "PRO", "LEGEND"].map((d) => `<option ${this.save.options.difficulty === d ? "selected" : ""}>${d}</option>`).join("")}</select></label><label>PLAY TO<select data-option="points">${[5, 7, 11].map((n) => `<option ${this.save.options.points === n ? "selected" : ""} value="${n}">${n} POINTS · WIN BY 2</option>`).join("")}</select></label><button class="start-button" data-action="play">LET'S PLAY ▶</button><div class="mode-links"><button data-action="tournament">TOURNAMENT →</button><button data-action="challenges">CHALLENGES →</button></div></div></div></section>`;
    document.getElementById("rival-select")?.addEventListener("change", (e) => {
      this.opponent = Number((e.target as HTMLSelectElement).value);
      this.setup();
    });
  }
  private asset(name: string) {
    return import.meta.env.BASE_URL + "assets/" + name;
  }
  private characters() {
    this.view = "characters";
    this.ui.innerHTML = `<section class="screen panel">${this.header("MEET THE BAD COMPANY", "CHARACTERS / ALL PERSONAL. ALL FICTIONAL.")}<div class="roster-grid">${ROSTER.map(
      (c) => {
        const unlocked = this.save.characters.includes(c.id);
        return `<button class="roster-card ${c.id === this.save.hero ? "selected" : ""} ${unlocked ? "" : "locked"}" data-action="pick-character" data-value="${c.id}" style="--character:${c.color}"><img src="${this.asset("portrait-" + c.id + ".png")}" alt="${c.name}"><strong>${c.nick}</strong><span>${c.country}</span><small>${unlocked ? "SELECT PLAYER" : "UNLOCK WITH WINS"}</small></button>`;
      },
    ).join(
      "",
    )}</div><div class="locker"><label>OUTFIT<select id="outfit">${["ORIGINAL", "NIGHT SHIFT", "GOLD LEAGUE"].map((n, i) => `<option value="${i}" ${this.save.outfit === i ? "selected" : ""} ${this.save.outfits.includes(i) ? "" : "disabled"}>${n}${this.save.outfits.includes(i) ? "" : " / " + (i === 1 ? "2" : "5") + " WINS"}</option>`).join("")}</select></label><label>PADDLE<select id="paddle">${["CLASSIC", "NEON EDGE", "GOLD STANDARD"].map((n, i) => `<option value="${i}" ${this.save.paddle === i ? "selected" : ""} ${this.save.paddles.includes(i) ? "" : "disabled"}>${n}${this.save.paddles.includes(i) ? "" : " / " + (i === 1 ? "1" : "4") + " WINS"}</option>`).join("")}</select></label><span>${this.save.wins} WINS / ${this.save.coins} CLUB POINTS</span><button class="accent-button" data-action="setup">QUICK MATCH →</button></div></section>`;
    ["outfit", "paddle"].forEach((key) =>
      document.getElementById(key)?.addEventListener("change", (e) => {
        this.save[key as "outfit" | "paddle"] = Number(
          (e.target as HTMLSelectElement).value,
        );
        this.persist();
      }),
    );
  }
  private story() {
    this.view = "story";
    const chapter = Math.min(11, this.save.story),
      c = OPPONENTS[STORY_ORDER[chapter]],
      a = ARENAS[STORY_ARENAS[chapter]];
    this.scene.previewArena(STORY_ARENAS[chapter]);
    this.ui.innerHTML = `<section class="screen panel story-screen">${this.header("THE CITY HAS YOUR NUMBER", "ARCADE STORY / CHAPTER " + String(chapter + 1).padStart(2, "0") + " OF 12")}<div class="story-layout"><div class="story-portrait" style="--character:${c.color}"><img src="${this.asset("portrait-" + c.id + ".png")}" alt="${c.name}"><span>${c.country}</span><h3>${c.nick}</h3></div><div class="story-copy"><span class="eyebrow">${a.name} / ${a.label}</span><h3>${chapter === 0 ? "A PADDLE. A DEBT. A VERY BAD IDEA." : chapter === 11 ? "LAST FLOOR. LAST LAUGH." : "ANOTHER CITY. ANOTHER BAD HAIRCUT."}</h3><blockquote>“${escape(c.line)}”</blockquote><p>The underground league has twelve tables and no dress code. Beat ${c.name} to stamp your passport, unlock this venue and move up the league.</p><p class="micro">${this.save.story === 12 ? "WORLD TOUR COMPLETE. REMATCH THE CHAMPION." : `${this.save.story} STAMPS COLLECTED / PROGRESS SAVED LOCALLY`}</p><button class="start-button" data-action="story-play">ENTER THE CLUB ▶</button></div></div><div class="passport">${Array.from({ length: 12 }, (_, i) => `<span class="${i < this.save.story ? "done" : i === chapter ? "current" : ""}">${String(i + 1).padStart(2, "0")}</span>`).join("")}</div></section>`;
  }
  private training() {
    this.view = "training";
    const drills = [
      ["free", "FREE PLAY", "Learn the court. No match pressure."],
      ["serves", "SERVICE STATION", "Cycle through eight legal serves."],
      ["topspin", "TOPSPIN LAB", "Lift, dip and accelerate the bounce."],
      ["backspin", "CHOP SHOP", "Read the spin. Open your paddle."],
      ["hands", "BOTH SIDES", "Switch forehand and backhand."],
    ];
    this.ui.innerHTML = `<section class="screen panel">${this.header("WELCOME TO THE SPIN LAB", "TRAINING / 68% SPEED. 100% STYLE.")}<p class="intro-copy">Move with the left thumb. Tap or swipe with the right. Hit as the ball reaches your glowing contact ring.</p><div class="drill-grid">${drills.map(([id, name, text], i) => `<button class="drill-card ${this.drill === id ? "selected" : ""}" data-action="drill" data-value="${id}"><b>0${i + 1}</b><h3>${name}</h3><p>${text}</p></button>`).join("")}</div><div class="training-guide"><div><b>↑ TOPSPIN</b><span>↓ BACKSPIN</span></div><div><b>← → SIDESPIN</b><span>DIAGONAL = MIXED</span></div><div><b>HOLD + RELEASE</b><span>POWER / TIGHTER TIMING</span></div><div><b>TAP = FLAT</b><span>HIGH BALL? SMASH.</span></div></div><button class="start-button bottom-cta" data-action="training-play">LET'S PRACTICE ▶</button><p class="keyboard-note">KEYBOARD: WASD / ARROWS move · SPACE hit · J top · K chop · U/I side · M smash · P pause</p></section>`;
  }
  private challenges() {
    this.view = "challenges";
    this.ui.innerHTML = `<section class="screen panel">${this.header("SMALL JOBS. BIG REPUTATION.", "CHALLENGES / KEEP YOUR CLUB POINTS")}<div class="challenge-list">${CHALLENGES.map((c, i) => `<button class="challenge-card ${this.save.challenges.includes(c.id) ? "completed" : ""}" data-action="challenge-play" data-value="${c.id}"><span>0${i + 1}</span><div><h3>${c.name}</h3><p>${c.description}</p></div><b>${this.save.challenges.includes(c.id) ? "COMPLETE ✓" : "+150 →"}</b></button>`).join("")}</div></section>`;
  }
  private tournament() {
    this.view = "tournament";
    this.tournamentRound = this.tour.round;
    const rounds = ["QUARTER-FINAL", "SEMI-FINAL", "CHAMPIONSHIP"];
    const name = (id: string) =>
      id === "player" ? character(this.tour.hero).nick : character(id).nick;
    this.ui.innerHTML = `<section class="screen panel">${this.header("EIGHT ENTER. ONE LEAVES LOUDER.", "TOURNAMENT / THREE MATCHES TO GLORY")}<div class="bracket">${[
      0, 1, 2,
    ]
      .map(
        (round) =>
          `<div class="bracket-round ${round === this.tournamentRound ? "current" : ""}"><span class="eyebrow">${rounds[round]}</span>${Array.from(
            { length: 2 ** (2 - round) },
            (_, i) => {
              const pair = this.tour.rounds[round]?.[i];
              return `<div class="bracket-pair"><span>${pair ? name(pair.players[0]) : "WINNER " + (i * 2 + 1)} ${pair?.score ? " / " + pair.score[0] : ""}</span><span>${pair ? name(pair.players[1]) : "WINNER " + (i * 2 + 2)} ${pair?.score ? " / " + pair.score[1] : ""}</span>${pair?.winner ? "<b>FINAL ✓</b>" : ""}</div>`;
            },
          ).join("")}</div>`,
      )
      .join(
        "",
      )}</div><button class="start-button bottom-cta" data-action="tournament-play">PLAY ${rounds[this.tournamentRound]} ▶</button></section>`;
  }
  private options() {
    this.view = "options";
    const o = this.save.options;
    const toggle = (key: keyof Options, name: string, desc: string) =>
      `<label class="toggle-row"><div><strong>${name}</strong><small>${desc}</small></div><input type="checkbox" data-option="${key}" ${o[key] ? "checked" : ""}><span class="switch"></span></label>`;
    const slider = (
      key: keyof Options,
      name: string,
      min: number,
      max: number,
      step: number,
    ) =>
      `<label class="slider-row"><span>${name}</span><output id="value-${key}">${Number(o[key]).toFixed(2)}</output><input type="range" data-option="${key}" min="${min}" max="${max}" step="${step}" value="${o[key]}"></label>`;
    this.ui.innerHTML = `<section class="screen panel">${this.header("TUNE YOUR MACHINE", "OPTIONS / SAVED ON THIS DEVICE")}<div class="options-grid"><div><h3>AUDIO / FEEL</h3>${toggle("music", "MUSIC", "Original 13-theme synth sequencer")}${toggle("sfx", "SOUND EFFECTS", "Paddle, bounce, crowd & chiptune voices")}${slider("volume", "MASTER VOLUME", 0, 1, 0.05)}${toggle("haptics", "HAPTICS", "Where the browser supports vibration")}<button class="text-link" data-action="install">INSTALL ON IPHONE →</button></div><div><h3>THUMB WORK</h3>${toggle("leftHanded", "LEFT-HANDED", "Move on the right. Swing on the left.")}${toggle("swapped", "SWAP CONTROL ZONES", "Exchange movement and swing zones")}${toggle("assist", "POSITION ASSIST", "Your feet follow the incoming ball")}${slider("sensitivity", "GESTURE SENSITIVITY", 0.5, 2, 0.05)}${slider("zoneSize", "CONTROL SIZE", 0.75, 1.3, 0.05)}<label class="inline-select">PADDLE HAND<select data-option="manualHand">${["auto", "forehand", "backhand"].map((v) => `<option value="${v}" ${o.manualHand === v ? "selected" : ""}>${v.toUpperCase()}</option>`).join("")}</select></label></div><div><h3>THE HOUSE RULES</h3><label class="inline-select">DIFFICULTY<select data-option="difficulty">${["ROOKIE", "PRO", "LEGEND"].map((v) => `<option ${o.difficulty === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label class="inline-select">POINTS PER GAME<select data-option="points">${[5, 7, 11].map((v) => `<option value="${v}" ${o.points === v ? "selected" : ""}>${v} / WIN BY 2</option>`).join("")}</select></label><p class="micro">Rules and difficulty apply to your next match. Physics stay the same.</p><button class="outline-button" data-action="debug">DEBUG ${this.debug ? "ON" : "OFF"}</button><p class="micro">FPS / X Y Z / VELOCITY / SPIN / AI<br>TOGGLE WITH THE BACKTICK KEY</p><button class="outline-button" data-action="update">CHECK FOR UPDATE</button></div></div></section>`;
  }
  private option(event: Event) {
    const target = event.target as HTMLInputElement;
    const key = target.dataset.option as keyof Options;
    if (!key) return;
    const value =
      target.type === "checkbox"
        ? target.checked
        : ["volume", "sensitivity", "zoneSize", "points"].includes(key)
          ? Number(target.value)
          : target.value;
    (this.save.options as any)[key] = value;
    this.persist();
    this.audio.apply();
    const output = document.getElementById("value-" + key);
    if (output) output.textContent = Number(value).toFixed(2);
    if (this.controls) this.controls.options = this.save.options;
    if (this.match && ["assist", "manualHand", "haptics"].includes(key))
      (this.match.config.options as any)[key] = value;
  }
  private play(mode: Mode) {
    this.controls?.destroy();
    this.shot = "flat";
    let arena = this.arena,
      opponent = this.opponent;
    if (mode === "story") {
      const chapter = Math.min(11, this.save.story);
      arena = STORY_ARENAS[chapter];
      opponent = STORY_ORDER[chapter];
    }
    if (mode === "tournament") {
      opponent = OPPONENTS.findIndex((c) => c.id === this.tour.opponent());
      this.tournamentRound = this.tour.round;
      arena = [1, 4, 10][this.tournamentRound];
    }
    if (mode === "training" || mode === "challenge") {
      arena = 8;
      opponent = 8;
    }
    const config: MatchConfig = {
      hero: this.save.hero,
      opponent: OPPONENTS[opponent].id,
      arena,
      mode,
      options: { ...this.save.options },
      drill: this.drill,
      challenge: this.challenge,
      seed: 1982 + this.save.wins * 11,
    };
    this.launch(new Match(config));
    if (mode === "training") {
      this.setShot(
        this.drill === "hands"
          ? "forehand"
          : this.drill === "topspin"
            ? "topspin"
            : this.drill === "backspin"
              ? "backspin"
              : "flat",
      );
    }
  }
  private launch(match: Match) {
    this.view = "game";
    this.match = match;
    this.clock = 0;
    this.hudClock = 0;
    const reverse = this.save.options.leftHanded !== this.save.options.swapped;
    this.ui.innerHTML = `<section class="game-hud" id="hud" data-state="${match.state}"><header class="scoreboard"><div class="player-name"><i class="player-dot"></i><span>${character(match.config.hero).nick}</span><small>YOU / ${match.config.mode.toUpperCase()}</small></div><div class="score-center"><span id="score-you">${match.rules.score[0]}</span><b>:</b><span id="score-ai">${match.rules.score[1]}</span></div><div class="rival-name"><span>${character(match.config.opponent).nick}</span><small id="server-label">YOUR SERVE</small></div><button class="pause-button" data-action="pause" aria-label="Pause"><i></i><i></i></button></header><div class="venue-label"><b>${ARENAS[match.config.arena].name}</b><span>${ARENAS[match.config.arena].city}</span></div><div class="rally-count">RALLY <b id="rally">00</b></div><div id="game-input" class="game-input ${reverse ? "reverse" : ""}" style="--zone:${this.save.options.zoneSize}"><div class="joystick"><span>MOVE</span><i><b></b></i><small>WASD / ARROWS</small></div><div class="strike-zone"><span>HIT / SWIPE</span><i>↑<b>+</b>↓</i><small>TAP / SPACE</small></div></div><div class="timing" id="timing"></div><div class="match-feedback" id="match-feedback">TAP TO SERVE</div><div class="shot-tools"><button data-action="arsenal" id="shot-label">FLAT DRIVE ▾</button><button data-action="serve-style" id="serve-style">SERVE: LONG ↻</button><button data-action="smash" id="smash" disabled>SMASH!</button></div><div class="spin-meter"><span>SPIN</span><b id="spin-value">—</b><div><i id="spin-bar"></i></div></div><div class="game-tip" id="game-tip">TAP OR PRESS SPACE TO SERVE · HIT AT THE CONTACT RING</div><pre id="debug" class="${this.debug ? "" : "hidden"}"></pre></section><div id="modal-layer"></div>`;
    this.controls = new Controls(
      document.getElementById("game-input")!,
      this.save.options,
    );
    this.controls.onStroke = (g) => {
      match.input(g);
    };
    this.controls.onPause = () => this.pause();
    this.setShot(this.shot);
    this.setText("serve-style", "SERVE: " + match.serveStyle + " ↻");
    match.onEvent = (e) => this.event(e, match);
    this.scene.start(match, this.controls);
    this.scene.setCosmetics(this.save.outfit, this.save.paddle);
    this.audio.playTheme(
      match.config.arena,
      OPPONENTS.findIndex((c) => c.id === match.config.opponent) + 1,
    );
    void this.audio.unlock();
  }
  private event(e: MatchEvent, m: Match) {
    if (e.type === "hit") {
      this.scene.impact();
      this.audio.sfx(
        e.shot === "smash"
          ? "smash"
          : ["topspin", "backspin", "side-left", "side-right"].includes(
                e.shot ?? "",
              )
            ? "spin"
            : "hit",
        SHOTS.find((s) => s.id === e.shot)?.power ?? 1,
      );
      if (e.text) {
        this.toast(e.text);
        this.audio.sfx("voice");
      }
      this.audio.setIntensity(m.rally);
      if (this.save.options.haptics && typeof navigator.vibrate === "function")
        navigator.vibrate(e.shot === "smash" ? 25 : 8);
      if (m.training && this.drill === "hands" && e.side === 0)
        this.setShot(this.shot === "forehand" ? "backhand" : "forehand");
    }
    if (e.type === "bounce") this.audio.sfx("bounce");
    if (e.type === "net") this.audio.sfx("net");
    if (e.type === "let") this.toast("LET. Net on service — serve again.");
    if (e.type === "timing") {
      this.setText("timing", e.timing ?? "");
      document
        .getElementById("timing")
        ?.setAttribute("data-timing", e.timing ?? "");
      this.timingUntil = m.clock + 0.65;
    }
    if (e.type === "point") {
      this.audio.sfx("point");
      this.save.bestRally = Math.max(this.save.bestRally, m.bestRally);
      this.persist();
      this.audio.setIntensity(0);
    }
    if (
      e.type === "challenge" &&
      !this.save.challenges.includes(this.challenge)
    ) {
      this.save.challenges.push(this.challenge);
      this.save.coins += 150;
      this.persist();
      this.audio.sfx("win");
      this.toast("CHALLENGE COMPLETE / +150 CLUB POINTS");
    }
    if (e.type === "end") {
      this.storage.removeItem(MATCH_KEY);
      this.audio.sfx(e.side === 0 ? "win" : "lose");
      if (e.side === 0) {
        unlockWin(
          this.save,
          m.config.arena,
          m.config.opponent,
          m.config.mode === "story",
        );
        if (m.config.mode === "story" && this.save.story < 12) {
          const next = STORY_ARENAS[this.save.story];
          if (!this.save.arenas.includes(next)) this.save.arenas.push(next);
        }
        this.persist();
      }
      if (m.config.mode === "tournament") {
        this.tour.complete(m.rules.score, m.rules.target);
        this.tournamentRound = this.tour.round;
      }
      this.result(e.side === 0);
    }
  }
  private result(won: boolean) {
    const m = this.match!;
    this.view = "result";
    const tourWon =
      won && m.config.mode === "tournament" && this.tour.champion === "player";
    document.getElementById("modal-layer")!.innerHTML =
      `<div class="modal-scrim"><section class="result-card"><span class="eyebrow">${m.config.mode === "story" ? "WORLD TOUR / PASSPORT UPDATED" : tourWon ? "TOURNAMENT CHAMPION" : "END OF THE NIGHT"}</span><h2>${tourWon ? "KING OF THE CITY." : won ? "NICE SPIN." : "TOUGH CROWD."}</h2><div class="final-score">${m.rules.score[0]}<span>:</span>${m.rules.score[1]}</div><p>${won ? "REPUTATION +100 / NEW STYLE UNLOCKS WITH WINS" : "THE CITY WILL REMEMBER YOUR COMEBACK."}</p><small>BEST RALLY ${m.bestRally} / PERFECT RETURNS ${m.stats.perfect}</small><div class="result-actions"><button class="start-button" data-action="next">${won && m.config.mode === "story" ? "NEXT CHAPTER" : won && m.config.mode === "tournament" && !this.tour.champion ? "NEXT ROUND" : "PLAY AGAIN"} ▶</button><button class="outline-button" data-action="home">MAIN MENU</button></div></section></div>`;
  }
  pause() {
    if (
      !this.match ||
      this.match.state === "over" ||
      this.view === "pause" ||
      this.view === "options" ||
      this.view === "arsenal"
    )
      return;
    this.match.pause();
    this.controls?.reset();
    this.view = "pause";
    this.storeMatch();
    this.audio.suspend();
    document.getElementById("modal-layer")!.innerHTML =
      `<div class="modal-scrim"><section class="pause-card"><span class="eyebrow">THE CITY CAN WAIT.</span><h2>PAUSED</h2><button class="start-button" data-action="resume">BACK TO THE TABLE ▶</button><button class="outline-button" data-action="restart">RESTART MATCH</button><button class="outline-button" data-action="options">OPTIONS</button><button class="quiet" data-action="home">SAVE & MAIN MENU</button></section></div>`;
  }
  private resume() {
    if (!this.match) return;
    this.view = "game";
    document.getElementById("modal-layer")!.innerHTML = "";
    this.match.resume();
    void this.audio.unlock();
  }
  private storeMatch() {
    if (!this.match || this.match.state === "over") return;
    try {
      this.storage.setItem(
        MATCH_KEY,
        JSON.stringify({
          match: this.match.snapshot(),
          tournamentRound: this.tournamentRound,
          tournament: this.tour.snapshot(),
        }),
      );
    } catch {}
  }
  private restore() {
    try {
      const raw = JSON.parse(this.storage.getItem(MATCH_KEY) ?? "null");
      const match = Match.restore(raw.match);
      this.tournamentRound = Math.min(2, Number(raw.tournamentRound) || 0);
      if (raw.tournament) this.tour = Tournament.restore(raw.tournament);
      this.launch(match);
      this.view = "game";
      this.pause();
    } catch {
      this.storage.removeItem(MATCH_KEY);
      this.toast("Saved match could not be restored. Your progress is safe.");
      this.home();
    }
  }
  private setShot(id: ShotId) {
    this.shot = id;
    if (this.controls) this.controls.selected = id;
    this.setText("shot-label", SHOTS.find((s) => s.id === id)!.name + " ▾");
  }
  private arsenal() {
    if (!this.match) return;
    this.match.pause();
    this.controls?.reset();
    this.view = "arsenal";
    document.getElementById("modal-layer")!.innerHTML =
      `<div class="modal-scrim"><section class="arsenal-card"><div class="arsenal-heading"><h3>PICK YOUR TROUBLE.</h3><button data-action="resume" class="quiet">CLOSE ×</button></div><div class="shot-grid">${SHOTS.map((s) => `<button data-action="shot" data-value="${s.id}" class="${this.shot === s.id ? "selected" : ""}"><strong>${s.name}</strong><small>POWER ${Math.round(s.power * 100)} / SPIN ${s.top || s.side || "—"}</small></button>`).join("")}</div></section></div>`;
  }
  private frame(m: Match, delta: number) {
    this.clock += delta;
    this.hudClock += delta;
    if (this.hudClock < 70) return;
    this.hudClock = 0;
    const hud = document.getElementById("hud");
    if (!hud) return;
    hud.dataset.state = m.state;
    hud.dataset.paused = String(m.paused);
    this.setText("score-you", String(m.rules.score[0]));
    this.setText("score-ai", String(m.rules.score[1]));
    this.setText(
      "server-label",
      (m.rules.server === 0 ? "YOUR" : "RIVAL") +
        " SERVE / TO " +
        m.rules.target,
    );
    this.setText("rally", String(m.rally).padStart(2, "0"));
    this.setText(
      "match-feedback",
      m.state === "ready"
        ? m.rules.server === 0
          ? "YOUR SERVE / TAP TO START"
          : "RIVAL SERVES"
        : m.state === "toss"
          ? "SERVICE"
          : m.state === "point"
            ? m.feedback
            : "",
    );
    const spin = Math.hypot(m.ball.w.x, m.ball.w.z);
    this.setText(
      "spin-value",
      spin < 20
        ? "FLAT"
        : Math.abs(m.ball.w.z) > Math.abs(m.ball.w.x)
          ? m.ball.w.z > 0
            ? "SIDE →"
            : "← SIDE"
          : m.ball.w.x * m.ball.v.y < 0
            ? "TOP ↑"
            : "CUT ↓",
    );
    const bar = document.getElementById("spin-bar");
    if (bar) bar.style.width = Math.min(100, spin / 4) + "%";
    const smash = document.getElementById("smash") as HTMLButtonElement | null;
    if (smash) smash.disabled = !m.smashAvailable;
    if (m.clock > this.timingUntil) this.setText("timing", "");
    if (m.training || m.config.mode === "challenge") {
      const hints = [
        "HIT AS THE BALL REACHES YOUR CONTACT RING",
        "SWIPE ↑ TOP / ↓ CHOP / ← → SIDE",
        "HOLD THEN RELEASE FOR A POWER SHOT",
        "TRY THE FULL SHOT MENU / FLAT DRIVE ▾",
      ];
      const c = CHALLENGES.find((c) => c.id === m.config.challenge);
      const value = m.stats[m.config.challenge as keyof typeof m.stats] ?? 0;
      this.setText(
        "game-tip",
        m.config.mode === "challenge"
          ? `${c?.name} / ${value} OF ${c?.goal}`
          : hints[Math.floor(m.clock / 7) % hints.length],
      );
    } else
      this.setText(
        "game-tip",
        m.state === "ready"
          ? "TAP / SPACE TO SERVE · P TO PAUSE"
          : "SWIPE TO SPIN · HOLD FOR POWER · HIT AT THE CONTACT RING",
      );
    if (this.debug) {
      const b = m.ball;
      this.setText(
        "debug",
        `FPS ${Math.round(1000 / Math.max(1, delta))} | FIXED 120 Hz\nXYZ ${b.p.x.toFixed(2)} ${b.p.y.toFixed(2)} ${b.p.z.toFixed(2)}\nVEL ${b.v.x.toFixed(2)} ${b.v.y.toFixed(2)} ${b.v.z.toFixed(2)}\nSPIN ${b.w.x.toFixed(0)} ${b.w.y.toFixed(0)} ${b.w.z.toFixed(0)}\nBOUNCE ${m.predicted?.x.toFixed(2) ?? "-"} ${m.predicted?.y.toFixed(2) ?? "-"}\nAI ${m.ai.plan.state}\n${m.rules.phase} / ${m.lastShot}`,
      );
    }
    if (this.clock > 2000) {
      this.storeMatch();
      this.clock = 0;
    }
  }
  private setText(id: string, value: string) {
    const e = document.getElementById(id);
    if (e && e.textContent !== value) e.textContent = value;
  }
  private action(action: string, value: string) {
    switch (action) {
      case "setup":
        this.setup();
        break;
      case "home":
        this.storeMatch();
        this.home();
        break;
      case "back":
        if (this.fromPause && this.match) {
          this.launch(this.match);
          this.view = "game";
          this.pause();
          this.fromPause = false;
        } else this.home();
        break;
      case "hero":
        this.save.hero = value;
        this.persist();
        this.setup();
        break;
      case "pick-character":
        if (this.save.characters.includes(value)) {
          this.save.hero = value;
          this.persist();
          this.characters();
        } else
          this.toast("Win matches to unlock rival outfits and characters.");
        break;
      case "arena":
        if (this.save.arenas.includes(Number(value))) {
          this.arena = Number(value);
          this.setup();
        } else
          this.toast("Win this venue in Story to unlock it for Quick Match.");
        break;
      case "play":
        this.play("quick");
        break;
      case "story":
        this.story();
        break;
      case "story-play":
        this.play("story");
        break;
      case "training":
        this.training();
        break;
      case "drill":
        this.drill = value;
        this.training();
        break;
      case "training-play":
        this.play("training");
        break;
      case "characters":
        this.characters();
        break;
      case "challenges":
        this.challenges();
        break;
      case "challenge-play":
        this.challenge = value;
        this.play("challenge");
        break;
      case "tournament":
        this.tournamentRound = 0;
        this.tour = new Tournament(this.save.hero, 1982 + this.save.wins);
        this.tournament();
        break;
      case "tournament-play":
        this.play("tournament");
        break;
      case "options":
        this.fromPause = !!this.match;
        this.options();
        break;
      case "pause":
        this.pause();
        break;
      case "resume":
        this.resume();
        break;
      case "restart":
        if (this.match) {
          this.storage.removeItem(MATCH_KEY);
          this.launch(
            new Match({
              ...this.match.config,
              options: { ...this.save.options },
            }),
          );
        }
        break;
      case "arsenal":
        this.arsenal();
        break;
      case "shot":
        this.setShot(value as ShotId);
        this.resume();
        break;
      case "serve-style":
        if (this.match) {
          this.match.serveStyle =
            SERVES[(SERVES.indexOf(this.match.serveStyle) + 1) % SERVES.length];
          this.setText("serve-style", "SERVE: " + this.match.serveStyle + " ↻");
        }
        break;
      case "smash":
        if (this.match?.smashAvailable)
          this.match.input({
            shot: "smash",
            aim: this.controls?.aim ?? 0,
            charge: 0,
            mixed: 0,
          });
        break;
      case "restore":
        this.restore();
        break;
      case "next":
        if (this.match) {
          const mode = this.match.config.mode;
          const won = this.match.rules.winner() === 0;
          if (mode === "story" && won) this.story();
          else if (mode === "tournament" && won && !this.tour.champion) {
            this.tournament();
          } else {
            if (mode === "tournament") {
              this.tournamentRound = 0;
              this.tour = new Tournament(this.save.hero, 1982 + this.save.wins);
            }
            this.play(mode);
          }
        }
        break;
      case "install":
        this.install();
        break;
      case "debug":
        this.debug = !this.debug;
        this.options();
        break;
      case "update":
        void navigator.serviceWorker
          ?.getRegistration()
          .then(async (r) => {
            await r?.update();
            if (r?.waiting) {
              r.waiting.postMessage("ACTIVATE");
              location.reload();
            } else this.toast("You have the latest cached version.");
          })
          .catch(() => this.toast("Connect once to check for updates."));
        break;
    }
  }
  private install() {
    const old = this.view;
    this.view = "install";
    this.ui.innerHTML = `<section class="screen panel install-screen">${this.header("PUT THE CITY IN YOUR POCKET", "INSTALL / IPHONE + SAFARI")}<div class="install-layout"><img src="${this.asset("icon-512.png")}" alt="Spin City app icon"><div><h3>YOUR OWN POCKET ARCADE.</h3><ol><li>Open the HTTPS game URL in <b>Safari</b>.</li><li>Tap <b>Share</b>, then <b>Add to Home Screen</b>.</li><li>Enable <b>Open as Web App</b> if Safari asks.</li><li>Launch SPIN CITY from your home screen and rotate your phone.</li></ol><p>Wait for “OFFLINE READY” on the first visit. After that, the full game and world tour work without a connection.</p><p class="micro">AUDIO STARTS WITH YOUR FIRST TAP. SAVES STAY ON THIS DEVICE.</p></div></div></section>`;
    if (old === "game") this.match?.pause();
  }
}
