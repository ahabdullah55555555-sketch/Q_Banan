"use strict";
/* Q_Banan service worker — offline app shell. No network, no Firebase, no login.
   Drafts live in localStorage on the phone only; the SW only caches app files. */
var CACHE = "qbanan-v4";
var FILES = [
  "./",
  "index.html",
  "manifest.json",
  "pptxgen.bundle.js",
  "html2canvas.min.js",
  "jspdf.umd.min.js",
  "icon.svg"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
