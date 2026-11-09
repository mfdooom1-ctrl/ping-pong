import { clamp } from "../physics/ball";
export interface Options {
  music: boolean;
  sfx: boolean;
  volume: number;
  sensitivity: number;
  leftHanded: boolean;
  zoneSize: number;
  assist: boolean;
  manualHand: "auto" | "forehand" | "backhand";
  difficulty: "ROOKIE" | "PRO" | "LEGEND";
  points: 5 | 7 | 11;
  haptics: boolean;
  swapped: boolean;
}
export interface Save {
  version: 1;
  hero: string;
  story: number;
  wins: number;
  bestRally: number;
  coins: number;
  arenas: number[];
  characters: string[];
  outfits: number[];
  paddles: number[];
  outfit: number;
  paddle: number;
  challenges: string[];
  options: Options;
}
export const DEFAULT_OPTIONS: Options = {
  music: true,
  sfx: true,
  volume: 0.55,
  sensitivity: 1,
  leftHanded: false,
  zoneSize: 1,
  assist: true,
  manualHand: "auto",
  difficulty: "ROOKIE",
  points: 5,
  haptics: false,
  swapped: false,
};
export const freshSave = (): Save => ({
  version: 1,
  hero: "johnny",
  story: 0,
  wins: 0,
  bestRally: 0,
  coins: 0,
  arenas: [0, 1, 3, 8],
  characters: ["johnny", "tony"],
  outfits: [0],
  paddles: [0],
  outfit: 0,
  paddle: 0,
  challenges: [],
  options: { ...DEFAULT_OPTIONS },
});
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export const SAVE_KEY = "spin-city-v1";
export function loadSave(storage: StorageLike): Save {
  const d = freshSave();
  try {
    const raw = JSON.parse(storage.getItem(SAVE_KEY) ?? "null");
    if (!raw || raw.version !== 1) return d;
    for (const key of ["story", "wins", "bestRally", "coins"] as const)
      if (Number.isFinite(raw[key]))
        d[key] = Math.floor(clamp(raw[key], 0, key === "story" ? 12 : 999999));
    if (typeof raw.hero === "string" && raw.hero.length < 30) d.hero = raw.hero;
    for (const key of ["arenas", "outfits", "paddles"] as const)
      if (Array.isArray(raw[key]))
        d[key] = [
          ...new Set<number>([
            0,
            ...raw[key].filter(
              (v: unknown) =>
                Number.isInteger(v) &&
                Number(v) >= 0 &&
                Number(v) < (key === "arenas" ? 12 : 4),
            ),
          ]),
        ];
    for (const key of ["characters", "challenges"] as const)
      if (Array.isArray(raw[key]))
        d[key] = raw[key]
          .filter((v: unknown) => typeof v === "string" && v.length < 32)
          .slice(0, 20);
    d.characters = [...new Set(["johnny", "tony", ...d.characters])];
    if (d.outfits.includes(raw.outfit)) d.outfit = raw.outfit;
    if (d.paddles.includes(raw.paddle)) d.paddle = raw.paddle;
    const o = raw.options ?? {};
    for (const k of [
      "music",
      "sfx",
      "leftHanded",
      "assist",
      "haptics",
      "swapped",
    ] as const)
      if (typeof o[k] === "boolean") d.options[k] = o[k];
    for (const [k, min, max] of [
      ["volume", 0, 1],
      ["sensitivity", 0.5, 2],
      ["zoneSize", 0.75, 1.3],
    ] as const)
      if (Number.isFinite(o[k])) d.options[k] = clamp(o[k], min, max);
    if (["ROOKIE", "PRO", "LEGEND"].includes(o.difficulty))
      d.options.difficulty = o.difficulty;
    if ([5, 7, 11].includes(o.points)) d.options.points = o.points;
    if (["auto", "forehand", "backhand"].includes(o.manualHand))
      d.options.manualHand = o.manualHand;
  } catch {
    /* Corrupt or unavailable storage falls back to a playable fresh save. */
  }
  return d;
}
export function saveProgress(storage: StorageLike, save: Save): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
export function unlockWin(
  save: Save,
  arena: number,
  opponent: string,
  story: boolean,
) {
  save.wins++;
  save.coins += 100;
  if (!save.arenas.includes(arena)) save.arenas.push(arena);
  if (story) save.story = Math.min(12, save.story + 1);
  if (save.wins % 2 === 0 && !save.characters.includes(opponent))
    save.characters.push(opponent);
  if (save.wins >= 2 && !save.outfits.includes(1)) save.outfits.push(1);
  if (save.wins >= 5 && !save.outfits.includes(2)) save.outfits.push(2);
  if (save.wins >= 1 && !save.paddles.includes(1)) save.paddles.push(1);
  if (save.wins >= 4 && !save.paddles.includes(2)) save.paddles.push(2);
}
export function browserStorage(): StorageLike {
  try {
    const s = window.localStorage;
    s.getItem(SAVE_KEY);
    return s;
  } catch {
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
  }
}
