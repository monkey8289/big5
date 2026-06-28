/* HEXACO 성격검사 Service Worker — v16
   전략:
   - 내비게이션/HTML: network-first (새 버전 우선, 오프라인일 때만 캐시 폴백) → 스테일 방지
   - 정적 자산(icon/manifest 등): cache-first
   - 캐시 이름에 버전 포함, activate 시 옛 캐시 정리, skipWaiting + clients.claim
*/
var VER = 'hexaco-v16';
var CORE = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VER).then(function (c) {
      return c.addAll(CORE).catch(function () { /* 일부 실패 무시 */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== VER) { return caches.delete(k); } }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') { return; }
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) { return; } /* 같은 출처만 */

  var accept = (req.headers.get('accept') || '');
  var isNav = (req.mode === 'navigate') || accept.indexOf('text/html') >= 0;

  if (isNav) {
    /* network-first: 새 index.html 우선, 실패 시 캐시 폴백 */
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VER).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) {
          return m || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  /* 정적 자산: cache-first */
  e.respondWith(
    caches.match(req).then(function (m) {
      if (m) { return m; }
      return fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VER).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
