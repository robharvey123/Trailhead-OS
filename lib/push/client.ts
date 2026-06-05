// Browser-side Web Push helpers (brief 17). Imported only by client components.

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  return navigator.serviceWorker.register('/sw.js')
}

/**
 * Prompt for permission, subscribe via the PushManager, and persist the
 * subscription server-side. Returns the subscription, or null if unsupported /
 * permission not granted.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker()
  if (!reg) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const key = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC
  if (!key) return null

  // Reuse an existing subscription if present (avoids InvalidStateError).
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }))

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...sub.toJSON(), user_agent: navigator.userAgent }),
  })
  if (!res.ok) return null
  return sub
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })
  await sub.unsubscribe()
}

/** Is this browser already subscribed (a PushSubscription exists)? */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return !!sub
}

// PushManager wants the VAPID public key as bytes, not a base64 string.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}
