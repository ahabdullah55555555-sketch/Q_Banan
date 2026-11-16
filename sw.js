/* Q_Banan service worker — v2.4.
   Version: APP_VERSION here MUST match APP_VERSION in index.html (both are
   "2.4" in this release); the cache name is derived from it, so a release
   bump retires the old cache automatically.
   Fetch strategy: app shell (navigation + index.html) is NETWORK-FIRST with
   cache fallback — a refresh while online always fetches the fresh file,
   so a new version reaches the phone within 1-2 reloads, not 30. The big
   JS bundles are CACHE-FIRST (they change rarely and are heavy on weak
   Wi-Fi), falling back to the network when missing. Offline still works
   from the cache. */
var APP_VERSION = "3.3";
var CACHE = "qbanan-" + APP_VERSION;
var FILES = ["./", "index.html", "manifest.json", "pptxgen.bundle.js", "html2canvas.min.js", "jspdf.umd.min.js", "harfbuzz.js", "hb-wrapper.mjs", "hb-loader.mjs", "hb-wasm.js", "vec-fonts.js", "icon.svg"];

self.addEventListener("install", function(e){
  // Cache each file on its own: on weak Wi-Fi one slow file must not fail
  // the whole install (c.addAll would reject on a single failure).
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(FILES.map(function(f){
      return fetch(f, {cache:"no-store"}).then(function(r){
        if (r && r.ok) return c.put(f, r);
      }).catch(function(){});
    }));
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// The page can ask the waiting worker to take over immediately.
self.addEventListener("message", function(e){
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isShellRequest(req){
  // Navigations (the app page itself) and the app shell files.
  if (req.mode === "navigate") return true;
  var u = new URL(req.url);
  var p = u.pathname.split("/").pop();
  return p === "" || p === "index.html" || p === "manifest.json";
}

function netFirst(req, timeoutMs){
  return new Promise(function(resolve){
    var done = false;
    var timer = setTimeout(function(){
      if (!done){ done = true; caches.match(req, {ignoreSearch:true}).then(function(hit){ resolve(hit || new Response("offline", {status:503})); }); }
    }, timeoutMs || 8000);
    fetch(req).then(function(res){
      if (done) return;
      done = true; clearTimeout(timer);
      if (res && res.ok){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
      }
      resolve(res);
    }).catch(function(){
      if (done) return;
      done = true; clearTimeout(timer);
      caches.match(req, {ignoreSearch:true}).then(function(hit){ resolve(hit || new Response("offline", {status:503})); });
    });
  });
}

self.addEventListener("fetch", function(e){
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // only our own files
  if (isShellRequest(e.request)){
    e.respondWith(netFirst(e.request, 8000));
    return;
  }
  // Bundles / fonts: cache-first, then network (and cache the fresh copy).
  e.respondWith(caches.match(e.request).then(function(hit){
    if (hit) return hit;
    return fetch(e.request).then(function(res){
      if (res && res.ok){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
      }
      return res;
    });
  }));
});
