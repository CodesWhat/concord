import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api/client.js";

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

let vapidKeyCache: string | null = null;

async function getVapidKey(): Promise<string | null> {
  if (vapidKeyCache) return vapidKeyCache;
  try {
    const res = await api.get<{ vapidPublicKey: string | null }>("/api/v1/config/vapid-key");
    vapidKeyCache = res.vapidPublicKey;
    return vapidKeyCache;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(): PushNotificationState {
  const isSupported = "PushManager" in window && "Notification" in window && "serviceWorker" in navigator;
  const [isSubscribed, setIsSubscribed] = useState(false);
  const checkedRef = useRef(false);

  // Check current subscription status on mount
  useEffect(() => {
    if (!isSupported || checkedRef.current) return;
    checkedRef.current = true;

    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(sub !== null);
      });
    });
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const vapidKey = await getVapidKey();
    if (!vapidKey) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = subscription.toJSON();
    await api.post("/api/v1/users/@me/push-subscription", {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
    });

    setIsSubscribed(true);
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    // Use fetch directly since our api client's delete doesn't support body
    const endpoint = subscription.endpoint;
    await fetch("/api/v1/users/@me/push-subscription", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });

    await subscription.unsubscribe();
    setIsSubscribed(false);
  }, [isSupported]);

  return { isSupported, isSubscribed, subscribe, unsubscribe };
}
