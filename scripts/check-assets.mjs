import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const root = resolve("dist");
assert.ok(existsSync(root + "/index.html"), "Build dist first");
const html = readFileSync(root + "/index.html", "utf8");
const manifest = JSON.parse(
  readFileSync(root + "/manifest.webmanifest", "utf8"),
);
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(manifest.display, "standalone");
for (const icon of manifest.icons)
  assert.ok(existsSync(resolve(root, icon.src)), icon.src);
const sw = readFileSync(root + "/sw.js", "utf8");
const precache = JSON.parse(
  sw.match(/const FILES=(\[.*?\])\.map/s)?.[1] ?? "null",
);
assert.ok(Array.isArray(precache) && precache.length > 20);
for (const file of precache)
  assert.ok(existsSync(resolve(root, file)), "Missing precache entry " + file);
for (const file of readdirSync(root + "/assets"))
  if (/\.(png|ttf|json|js|css)$/.test(file))
    assert.ok(precache.includes("assets/" + file), "Asset not cached: " + file);
const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(
  (m) => m[1],
);
const script = resources.find((u) => u.endsWith(".js"));
assert.ok(script);
const base = script.slice(0, script.indexOf("assets/"));
assert.ok(base.startsWith("/") && base.endsWith("/"));
for (const url of resources) {
  assert.ok(!/^https?:/.test(url), "External dependency " + url);
  assert.ok(url.startsWith(base), "Wrong base " + url);
  assert.ok(existsSync(resolve(root, url.slice(base.length))));
}
console.log(
  `Verified ${precache.length} precached assets, ${resources.length} HTML resources and standalone PWA at base ${base}`,
);
