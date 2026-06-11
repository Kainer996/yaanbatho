const CACHE_NAME = "tap-town-expanded-20260608-bigmap-1";
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const cachePath = (path) => `${BASE_PATH}${path}` || "/";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css?v=20260608-bigmap-1",
  "/app.js?v=20260608-bigmap-1",
  "/app-core.js?v=20260608-bigmap-1",
  "/manifest.webmanifest",
  "/assets/icon.svg",
  "/assets/town-map.png",
  "/assets/sprites/buildings/hall.png",
  "/assets/sprites/buildings/cottage.png",
  "/assets/sprites/buildings/bakery.png",
  "/assets/sprites/buildings/solar.png",
  "/assets/sprites/buildings/park.png",
  "/assets/sprites/buildings/diner.png",
  "/assets/sprites/buildings/workshop.png",
  "/assets/sprites/buildings/cinema.png",
  "/assets/sprites/buildings/farm.png",
  "/assets/sprites/buildings/factory.png",
  "/assets/sprites/buildings/office.png",
  "/assets/sprites/buildings/market.png",
  "/assets/sprites/characters/homeowner.png",
  "/assets/sprites/characters/baker.png",
  "/assets/sprites/characters/farmer.png",
  "/assets/sprites/characters/factory_worker.png",
  "/assets/sprites/characters/office_worker.png",
  "/assets/sprites/characters/mechanic.png",
  "/assets/sprites/characters/florist.png",
  "/assets/sprites/characters/usher.png"
].map(cachePath);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("tap-town-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(BASE_PATH || "/tap-town")) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
