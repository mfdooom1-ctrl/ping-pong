import Phaser from "phaser";
import "./style.css";
import { ArcadeScene } from "./game/scenes/ArcadeScene";
import { App } from "./game/ui/App";
import { registerOffline } from "./pwa/register";

async function boot() {
  const appElement = document.getElementById("app")!;
  new ResizeObserver(() => {
    appElement.style.setProperty(
      "--scale",
      String(Math.min(appElement.clientWidth / 960, appElement.clientHeight / 540)),
    );
  }).observe(appElement);
  try {
    await document.fonts.load("16px Neon");
  } catch {}
  const scene = new ArcadeScene(() => {
    const app = new App(scene);
    document.getElementById("boot")?.remove();
    registerOffline((message) => app.toast(message));
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 960,
    height: 540,
    backgroundColor: "#100d26",
    pixelArt: true,
    roundPixels: true,
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
      powerPreference: "high-performance",
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540,
    },
    fps: { target: 120, forceSetTimeOut: false, smoothStep: true },
    audio: { noAudio: true },
    scene: [scene],
  });
  window.addEventListener("resize", () => game.scale.refresh());
}
void boot().catch((error) => {
  document.getElementById("boot")!.innerHTML =
    "THE NEON WENT OUT.<span>Reload to try again.</span>";
  console.error(error);
});
