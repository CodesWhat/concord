/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

// Precache assets injected by VitePWA
precacheAndRoute(self.__WB_MANIFEST);

// Handle push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "Concord", body: "New notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/web-app-manifest-192x192.png",
      badge: "/favicon.ico",
      data: { url: data.url ?? "/" },
    }),
  );
});

// Handle notification click — open the app to the relevant URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.navigate(event.notification.data?.url ?? "/");
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(event.notification.data?.url ?? "/");
    }),
  );
});
