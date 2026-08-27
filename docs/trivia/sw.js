/* Quick Draw Trivia — offline service worker.
   Registered from ./index.html, so its scope is /BidWhist/trivia/ only and it
   never sees requests for the tournament app. Never move this file up a level.

   Bump CACHE on every change to the game, or installed phones keep serving the
   old copy. Offline is the whole point here: the game is meant to be played on
   a plane, so everything it needs must be precached before takeoff. */

var CACHE = "qdt-v3";
var ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./questions.js",
  "./qrcode.js",
  "./jsQR.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        // Cache same-origin successes so a first-run miss still works offline later.
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        // A navigation that misses the cache falls back to the app shell.
        if (e.request.mode === "navigate") return caches.match("./index.html");
        throw new Error("offline");
      });
    })
  );
});
