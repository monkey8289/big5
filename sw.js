/* HEXACO 성격검사 Service Worker — v16
   전략:
   - 내비게이션/HTML: network-first (새 버전 우선, 오프라인일 때만 캐시 폴백) → 스테일 방지
   - 정적 자산(icon/manifest 등): cache-first
   - 캐시 이름에 버전 포함, activate 시 옛 캐시 정리, skipWaiting + clients.claim
*/
var VER = 'hexaco-v17';
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

/* 알림 클릭 → 열려 있으면 포커스, 아니면 새 창 */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cls) {
      for (var i = 0; i < cls.length; i++) {
        if ('focus' in cls[i]) { try { cls[i].focus(); } catch (x) {} return; }
      }
      if (self.clients.openWindow) { return self.clients.openWindow(target); }
    })
  );
});

/* 서버(FCM 등)가 보낸 푸시 → 알림 표시. 발송 서버는 별도 배포 필요(아래 가이드 참고). */
self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (x) {
    try { data = { title: 'HEXACO', body: e.data ? e.data.text() : '' }; } catch (y) {}
  }
  var opt = {
    body: data.body || '',
    icon: './icon.svg',
    badge: './icon.svg',
    tag: data.tag || 'hexaco-push',
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(data.title || 'HEXACO 성격검사', opt));
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
