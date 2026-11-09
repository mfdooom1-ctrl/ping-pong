import { clamp } from "../physics/ball";
import type { Options } from "../data/save";
import type { ShotId } from "../data/shots";
export interface Gesture {
  shot: ShotId;
  charge: number;
  mixed: number;
  aim: number;
}
export class Controls {
  x = 0;
  y = 0;
  aim = 0;
  stickActive = false;
  selected: ShotId = "flat";
  private keys = new Set<string>();
  private points = new Map<
    number,
    { x: number; y: number; time: number; left: boolean }
  >();
  private abort = new AbortController();
  onStroke: (g: Gesture) => void = () => {};
  onPause: () => void = () => {};
  constructor(
    private element: HTMLElement,
    public options: Options,
  ) {
    const signal = this.abort.signal;
    element.addEventListener("pointerdown", this.down, { signal });
    element.addEventListener("pointermove", this.move, { signal });
    element.addEventListener("pointerup", this.up, { signal });
    element.addEventListener("pointercancel", this.cancel, { signal });
    window.addEventListener(
      "keydown",
      (e) => {
        if ((e.target as HTMLElement)?.matches("input,select,button")) return;
        if (
          ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            e.code,
          )
        )
          e.preventDefault();
        if (e.repeat) return;
        this.keys.add(e.code);
        const shots: Record<string, ShotId> = {
          Space: this.selected,
          KeyJ: "topspin",
          KeyK: "backspin",
          KeyU: "side-left",
          KeyI: "side-right",
          KeyL: "lob",
          KeyO: "drop",
          KeyB: "block",
          KeyF: "flick",
          KeyM: "smash",
          KeyC: "counter",
          KeyE: "save",
        };
        if (shots[e.code])
          this.onStroke({
            shot: shots[e.code],
            charge: 0,
            mixed: 0,
            aim: this.aim,
          });
        if (e.code === "Escape" || e.code === "KeyP") this.onPause();
      },
      { signal },
    );
    window.addEventListener(
      "keyup",
      (e) => {
        this.keys.delete(e.code);
      },
      { signal },
    );
    window.addEventListener("blur", () => this.reset(), { signal });
  }
  private isLeft(clientX: number) {
    const r = this.element.getBoundingClientRect();
    const left = (clientX - r.left) / r.width < 0.5;
    return this.options.leftHanded !== this.options.swapped ? !left : left;
  }
  private down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button,select,input,a")) return;
    e.preventDefault();
    this.element.setPointerCapture(e.pointerId);
    const left = this.isLeft(e.clientX);
    this.points.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
      left,
    });
    if (left) {
      this.stickActive = true;
      this.x = 0;
      this.y = 0;
    }
    this.element.classList.toggle(
      "charging",
      [...this.points.values()].some((p) => !p.left),
    );
  };
  private move = (e: PointerEvent) => {
    const p = this.points.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.left) {
      const radius = 48 * this.options.zoneSize;
      this.x = clamp(
        ((e.clientX - p.x) / radius) * this.options.sensitivity,
        -1,
        1,
      );
      this.y = clamp(
        ((e.clientY - p.y) / radius) * this.options.sensitivity,
        -1,
        1,
      );
      this.aim = this.x * 0.6;
    }
  };
  private up = (e: PointerEvent) => {
    const p = this.points.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    this.points.delete(e.pointerId);
    if (p.left) {
      this.x = 0;
      this.y = 0;
      this.stickActive = false;
    } else {
      const rect = this.element.getBoundingClientRect();
      this.onStroke(recognizeGesture(
        (e.clientX - p.x) * 960 / rect.width,
        (e.clientY - p.y) * 540 / rect.height,
        performance.now() - p.time,
        this.options.sensitivity,
      ));
    }
    this.element.classList.toggle(
      "charging",
      [...this.points.values()].some((point) => !point.left),
    );
  };
  private cancel = (e: PointerEvent) => {
    const point = this.points.get(e.pointerId);
    this.points.delete(e.pointerId);
    if (point?.left) { this.x = 0; this.y = 0; this.stickActive = false; }
    this.element.classList.toggle("charging", [...this.points.values()].some(p => !p.left));
  };
  update() {
    if (!this.stickActive) {
      this.x =
        (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
        (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
      this.y =
        (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) -
        (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0);
      this.aim = this.x * 0.6;
    }
  }
  reset() {
    this.keys.clear();
    this.points.clear();
    this.x = 0;
    this.y = 0;
    this.stickActive = false;
    this.element.classList.remove("charging");
  }
  destroy() {
    this.abort.abort();
    this.reset();
  }
}

/** Screen right is world +X for the fixed player camera, including left-handed mode. */
export function recognizeGesture(dx: number, dy: number, duration: number, sensitivity = 1): Gesture {
  dx *= sensitivity;
  dy *= sensitivity;
  const distance = Math.hypot(dx, dy);
  const speed = distance / Math.max(40, duration);
  let shot: ShotId = "flat";
  let mixed = 0;
  if (distance >= 14) {
    if (distance < 45 && speed < 0.3) shot = "drop";
    else if (Math.abs(dx) > Math.abs(dy) * 0.65) {
      shot = dx < 0 ? "side-left" : "side-right";
      if (Math.abs(dy) > 18) mixed = dy < 0 ? 1 : -1;
    } else if (dy > 0) shot = "backspin";
    else shot = speed > 0.9 && distance > 85 ? "forehand" : "topspin";
  }
  return { shot, mixed, aim: clamp(dx / 180, -0.65, 0.65),
    charge: distance > 50 ? clamp((speed - 0.3) * 0.65, 0, 0.8) : 0 };
}
