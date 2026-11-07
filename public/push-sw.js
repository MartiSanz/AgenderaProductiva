// Messaging-only service worker: shows Agendera notifications. No caching.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

async function loadMessage() {
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (sub) {
      const res = await fetch("/api/public/push-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      if (res.ok) return await res.json();
    }
  } catch (e) {}
  return { title: "Agendera", body: "Tenés una novedad. Tocá para verla.", url: "/agenda" };
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    loadMessage().then((m) =>
      self.registration.showNotification(m.title, {
        body: m.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "agendera-" + Date.now(),
        data: { url: m.url },
      }),
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/agenda", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
