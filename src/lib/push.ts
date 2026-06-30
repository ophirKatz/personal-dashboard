import { supabase } from '../supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0))) as BufferSource
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

type PushResult = { ok: true } | { ok: false; error: string }

export async function enablePushNotifications(): Promise<PushResult> {
  if (!isPushSupported()) return { ok: false, error: 'UNSUPPORTED' }
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'MISSING_CONFIG' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: 'PERMISSION_DENIED' }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const keys = subscription.toJSON().keys
  if (!keys?.p256dh || !keys?.auth) return { ok: false, error: 'INVALID_SUBSCRIPTION' }

  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
  })
  if (!res.ok) return { ok: false, error: 'SERVER_ERROR' }

  return { ok: true }
}

export async function syncPushSubscription(): Promise<void> {
  if (!isPushSupported()) return
  const subscription = await getPushSubscription()
  if (!subscription) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const keys = subscription.toJSON().keys
  if (!keys?.p256dh || !keys?.auth) return

  await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
  })
}

export async function disablePushNotifications(): Promise<void> {
  const subscription = await getPushSubscription()
  if (!subscription) return

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    await fetch('/api/push-unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
  }

  await subscription.unsubscribe()
}
