import { defineConfig, type Plugin } from "vite";

function offline(): Plugin {
  return {
    name: "spin-city-offline",
    apply: "build",
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith(".map"));
      const portraits = [
        "johnny",
        "tony",
        "chen",
        "lin",
        "kenji",
        "akira",
        "dragan",
        "mila",
        "jack",
        "rico",
        "viktor",
        "marcus",
        "sofia",
        "kim",
      ].map((c) => "assets/portrait-" + c + ".png");
      const assets = [
        "index.html",
        "manifest.webmanifest",
        "assets/characters.png",
        "assets/characters.json",
        "assets/neon.ttf",
        "assets/icon-192.png",
        "assets/icon-512.png",
        "assets/apple-touch-icon.png",
        "assets/maskable-512.png",
        ...portraits,
      ];
      const precache = [...new Set([...files, ...assets])];
      // A content-derived cache name updates atomically; no network is needed after installation.
      const revision = files.join("|").replace(/[^\w]/g, "").slice(-100);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `
const ROOT=new URL('./',self.location.href);
const PREFIX='spin-city-'+ROOT.pathname+'-';
const CACHE=PREFIX+${JSON.stringify(revision)};
const FILES=${JSON.stringify(precache)}.map(p=>new URL(p,ROOT).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==ROOT.origin)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
   if(event.request.mode==='navigate'){
     const shell=await cache.match(new URL('index.html',ROOT).href,{ignoreVary:true});
     if(shell)return shell;
   }
   const hit=await cache.match(event.request,{ignoreSearch:true,ignoreVary:true});
   if(hit)return hit;
   try{return await fetch(event.request);}catch(error){
     if(event.request.mode==='navigate')return (await cache.match(new URL('index.html',ROOT).href))||Response.error();
     return Response.error();
   }
 }));
});`,
      });
    },
  };
}
const rawBase = process.env.VITE_BASE_PATH ?? "/ping-pong/";
const base =
  rawBase === "/" || !rawBase ? "/" : `/${rawBase.replace(/^\/+|\/+$/g, "")}/`;
export default defineConfig({
  base,
  plugins: [offline()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
} as any);
