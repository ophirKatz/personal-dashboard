import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, BellOff, Sparkles, Plus, X } from 'lucide-react'
import { supabase } from '../supabase'
import { Button } from '../components/ui/button'
import { haptic } from '../lib/haptics'
import { isPushSupported, getPushSubscription, enablePushNotifications, disablePushNotifications } from '../lib/push'
import {
  getAutoGenerateFocusSummariesDaily,
  setAutoGenerateFocusSummariesDaily,
  getAutoGenerateFocusSummariesOnChange,
  setAutoGenerateFocusSummariesOnChange,
} from '../lib/userSettings'
import { listGoogleAccounts, connectGoogleAccount, disconnectGoogleAccount, type GoogleAccount } from '../lib/googleAccounts'
import VoiceShortcutsSection from '../features/voice/VoiceShortcutsSection'

const GOOGLE_CONNECT_MESSAGES: Record<string, string> = {
  success: 'Google account connected.',
  denied: 'Connection was cancelled.',
  expired: 'That connection link expired. Please try again.',
  no_refresh_token: 'Google did not grant offline access. Please try again and accept all permissions.',
  error: 'Something went wrong connecting that account. Please try again.',
}

export default function Settings() {
  const [supported, setSupported] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
  }, [])

  const [searchParams, setSearchParams] = useSearchParams()
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([])
  const [googleAccountsLoading, setGoogleAccountsLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [connectMessage, setConnectMessage] = useState<string | null>(null)
  const connectStatus = searchParams.get('google_connect')

  useEffect(() => {
    listGoogleAccounts().then(accounts => {
      setGoogleAccounts(accounts)
      setGoogleAccountsLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!connectStatus) return
    setConnecting(false)
    setConnectMessage(connectStatus)
    const next = new URLSearchParams(searchParams)
    next.delete('google_connect')
    setSearchParams(next, { replace: true })
  }, [connectStatus])

  // If the user backs out of the Google redirect (e.g. taps the browser back
  // button) the page can be restored from the bfcache with `connecting` still
  // true, since no remount or callback redirect ever happens in that case.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setConnecting(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function handleConnectGoogleAccount() {
    setConnecting(true)
    setConnectMessage(null)
    haptic('selection')
    const redirected = await connectGoogleAccount()
    if (!redirected) setConnecting(false)
  }

  async function handleDisconnectGoogleAccount(id: string) {
    setDisconnectingId(id)
    haptic('selection')
    await disconnectGoogleAccount(id)
    setGoogleAccounts(accounts => accounts.filter(a => a.id !== id))
    setDisconnectingId(null)
  }

  const [autoGenerateFocusDaily, setAutoGenerateFocusDaily] = useState(true)
  const [focusDailyLoading, setFocusDailyLoading] = useState(true)
  const [focusDailyBusy, setFocusDailyBusy] = useState(false)

  const [autoGenerateFocusOnChange, setAutoGenerateFocusOnChange] = useState(true)
  const [focusOnChangeLoading, setFocusOnChangeLoading] = useState(true)
  const [focusOnChangeBusy, setFocusOnChangeBusy] = useState(false)

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

  useEffect(() => {
    getAutoGenerateFocusSummariesDaily().then(enabled => {
      setAutoGenerateFocusDaily(enabled)
      setFocusDailyLoading(false)
    })
    getAutoGenerateFocusSummariesOnChange().then(enabled => {
      setAutoGenerateFocusOnChange(enabled)
      setFocusOnChangeLoading(false)
    })
  }, [])

  async function toggleAutoGenerateFocusDaily() {
    setFocusDailyBusy(true)
    haptic('selection')
    const next = !autoGenerateFocusDaily
    await setAutoGenerateFocusSummariesDaily(next)
    setAutoGenerateFocusDaily(next)
    setFocusDailyBusy(false)
  }

  async function toggleAutoGenerateFocusOnChange() {
    setFocusOnChangeBusy(true)
    haptic('selection')
    const next = !autoGenerateFocusOnChange
    await setAutoGenerateFocusSummariesOnChange(next)
    setAutoGenerateFocusOnChange(next)
    setFocusOnChangeBusy(false)
  }

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

      <div className="bg-card border border-border rounded-2xl p-4 mt-4">
        <p className="font-medium mb-1">Connected Google accounts</p>
        <p className="text-sm text-muted-foreground mb-4">
          Calendar events from every connected account are shown together, color-coded by account.
        </p>

        {connectMessage && (
          <p className={`text-sm mb-3 ${connectMessage === 'success' ? 'text-primary' : 'text-destructive'}`}>
            {GOOGLE_CONNECT_MESSAGES[connectMessage] ?? GOOGLE_CONNECT_MESSAGES.error}
          </p>
        )}

        {googleAccountsLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {googleAccounts.map((account, i) => (
              <div key={account.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{account.email}</p>
                  {i === 0 && <p className="text-xs text-muted-foreground">Primary · also used for Tasks &amp; Drive</p>}
                </div>
                <button
                  onClick={() => handleDisconnectGoogleAccount(account.id)}
                  disabled={disconnectingId === account.id}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleConnectGoogleAccount} disabled={connecting} variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-1.5" />
          {connecting ? 'Redirecting…' : 'Connect another Google account'}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mt-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-muted">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">Daily focus refresh</p>
            <p className="text-sm text-muted-foreground">
              Automatically refresh the Focus section's AI summary once daily. Turn off to save API
              usage — you can still refresh it manually anytime.
            </p>
          </div>
          {!focusDailyLoading && (
            <button
              type="button"
              onClick={toggleAutoGenerateFocusDaily}
              disabled={focusDailyBusy}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${autoGenerateFocusDaily ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoGenerateFocusDaily ? 'translate-x-5' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mt-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-muted">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">Refresh on todo/event changes</p>
            <p className="text-sm text-muted-foreground">
              Automatically refresh the Focus section's AI summary when todos or events change. Turn
              off to save API usage — you can still refresh it manually anytime.
            </p>
          </div>
          {!focusOnChangeLoading && (
            <button
              type="button"
              onClick={toggleAutoGenerateFocusOnChange}
              disabled={focusOnChangeBusy}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${autoGenerateFocusOnChange ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoGenerateFocusOnChange ? 'translate-x-5' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {userId && <VoiceShortcutsSection userId={userId} />}
    </div>
  )
}
