const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const PUSH_ENABLED_KEY = "morning-push-enabled";

export type PushSubscribeResult =
  | "enabled"
  | "denied"
  | "unsupported"
  | "unconfigured"
  | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isMorningPushEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PUSH_ENABLED_KEY) === "1";
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string };
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

export async function registerServiceWorker(): Promise<void> {
  if (!isPushSupported()) return;
  await navigator.serviceWorker.register("/sw.js");
}

export async function subscribeMorningPush(): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return "unsupported";

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return "unconfigured";

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const res = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    if (!res.ok) return "error";

    window.localStorage.setItem(PUSH_ENABLED_KEY, "1");
    return "enabled";
  } catch {
    return "error";
  }
}
