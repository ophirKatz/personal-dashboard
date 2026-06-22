import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '../components/ui/button'
import { haptic } from '../lib/haptics'
import { isPushSupported, getPushSubscription, enablePushNotifications, disablePushNotifications } from '../lib/push'

export default function Settings() {
  const [supported, setSupported] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false)
      setLoading(false)
      return
    }
    getPushSubscription().then(sub => {
      setSubscribed(!!sub)
      setLoading(false)
    })
  }, [])

  async function toggle() {
    setBusy(true)
    setError(null)
    haptic('selection')
    if (subscribed) {
      await disablePushNotifications()
      setSubscribed(false)
    } else {
      const result = await enablePushNotifications()
      if (result.ok) {
        setSubscribed(true)
        haptic('success')
      } else {
        setError(
          result.error === 'PERMISSION_DENIED'
            ? 'Notification permission was denied. Enable it in your device settings.'
            : result.error === 'MISSING_CONFIG'
              ? 'Push notifications are not configured for this deployment.'
              : 'Could not enable push notifications. Please try again.',
        )
      }
    }
    setBusy(false)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-muted">
            {subscribed ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">Push notifications</p>
            <p className="text-sm text-muted-foreground">
              Get an alert on your device for due reminders and habit nudges.
            </p>
          </div>
        </div>

        {!supported ? (
          <p className="text-sm text-muted-foreground mt-4">
            Not supported in this browser. On iPhone, add this app to your Home Screen first
            (Share → Add to Home Screen), then open it from there and enable notifications.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <Button onClick={toggle} disabled={busy} className="w-full mt-4" variant={subscribed ? 'outline' : 'default'}>
              {busy ? 'Working…' : subscribed ? 'Disable notifications' : 'Enable notifications'}
            </Button>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
