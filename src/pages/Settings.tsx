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
  getShowFocusSection,
  setShowFocusSection,
  getDefaultFocusPeriod,
  setDefaultFocusPeriod,
  getBottomNavItems,
  setBottomNavItems,
  type FocusPeriod,
} from '../lib/userSettings'
import { listGoogleAccounts, connectGoogleAccount, disconnectGoogleAccount, type GoogleAccount } from '../lib/googleAccounts'
import { ALL_NAV_KEYS, NAV_ITEMS, BOTTOM_NAV_ITEMS_CHANGED_EVENT, type NavItemKey } from '../lib/navItems'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select'
import VoiceShortcutsSection from '../features/voice/VoiceShortcutsSection'

const GOOGLE_CONNECT_MESSAGES: Record<string, string> = {
  success: 'Google account connected.',
  denied: 'Connection was cancelled.',
  expired: 'That connection link expired. Please try again.',
  no_refresh_token: 'Google did not grant offline access. Please try again and accept all permissions.',
  error: 'Something went wrong connecting that account. Please try again.',
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
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

  const [autoGenerateFocusDaily, setAutoGenerateFocusDaily] = useState<Record<FocusPeriod, boolean>>({ today: true, week: true })
  const [focusDailyLoading, setFocusDailyLoading] = useState(true)
  const [focusDailyBusy, setFocusDailyBusy] = useState<Record<FocusPeriod, boolean>>({ today: false, week: false })

  const [autoGenerateFocusOnChange, setAutoGenerateFocusOnChange] = useState<Record<FocusPeriod, boolean>>({ today: true, week: true })
  const [focusOnChangeLoading, setFocusOnChangeLoading] = useState(true)
  const [focusOnChangeBusy, setFocusOnChangeBusy] = useState<Record<FocusPeriod, boolean>>({ today: false, week: false })

  const [showFocusSection, setShowFocusSectionState] = useState(true)
  const [showFocusSectionLoading, setShowFocusSectionLoading] = useState(true)
  const [showFocusSectionBusy, setShowFocusSectionBusy] = useState(false)

  const [defaultFocusPeriod, setDefaultFocusPeriodState] = useState<'today' | 'week'>('week')
  const [defaultFocusPeriodLoading, setDefaultFocusPeriodLoading] = useState(true)

  const [bottomNavItems, setBottomNavItemsState] = useState<NavItemKey[]>(['todos', 'calendar', 'files'])
  const [bottomNavLoading, setBottomNavLoading] = useState(true)

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
    Promise.all([getAutoGenerateFocusSummariesDaily('today'), getAutoGenerateFocusSummariesDaily('week')]).then(
      ([today, week]) => {
        setAutoGenerateFocusDaily({ today, week })
        setFocusDailyLoading(false)
      },
    )
    Promise.all([getAutoGenerateFocusSummariesOnChange('today'), getAutoGenerateFocusSummariesOnChange('week')]).then(
      ([today, week]) => {
        setAutoGenerateFocusOnChange({ today, week })
        setFocusOnChangeLoading(false)
      },
    )
    getShowFocusSection().then(show => {
      setShowFocusSectionState(show)
      setShowFocusSectionLoading(false)
    })
    getDefaultFocusPeriod().then(period => {
      setDefaultFocusPeriodState(period)
      setDefaultFocusPeriodLoading(false)
    })
    getBottomNavItems().then(items => {
      setBottomNavItemsState(items)
      setBottomNavLoading(false)
    })
  }, [])

  async function toggleAutoGenerateFocusDaily(period: FocusPeriod) {
    setFocusDailyBusy(busy => ({ ...busy, [period]: true }))
    haptic('selection')
    const next = !autoGenerateFocusDaily[period]
    await setAutoGenerateFocusSummariesDaily(period, next)
    setAutoGenerateFocusDaily(state => ({ ...state, [period]: next }))
    setFocusDailyBusy(busy => ({ ...busy, [period]: false }))
  }

  async function toggleAutoGenerateFocusOnChange(period: FocusPeriod) {
    setFocusOnChangeBusy(busy => ({ ...busy, [period]: true }))
    haptic('selection')
    const next = !autoGenerateFocusOnChange[period]
    await setAutoGenerateFocusSummariesOnChange(period, next)
    setAutoGenerateFocusOnChange(state => ({ ...state, [period]: next }))
    setFocusOnChangeBusy(busy => ({ ...busy, [period]: false }))
  }

  async function toggleShowFocusSection() {
    setShowFocusSectionBusy(true)
    haptic('selection')
    const next = !showFocusSection
    await setShowFocusSection(next)
    setShowFocusSectionState(next)
    setShowFocusSectionBusy(false)
  }

  async function handleDefaultFocusPeriodChange(period: 'today' | 'week') {
    haptic('selection')
    setDefaultFocusPeriodState(period)
    await setDefaultFocusPeriod(period)
  }

  async function handleBottomNavSlotChange(index: number, key: NavItemKey) {
    haptic('selection')
    const next = [...bottomNavItems]
    next[index] = key
    setBottomNavItemsState(next)
    await setBottomNavItems(next)
    window.dispatchEvent(new CustomEvent(BOTTOM_NAV_ITEMS_CHANGED_EVENT, { detail: next }))
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

      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Notifications</h2>
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

      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 mt-6">Accounts</h2>
      <div className="bg-card border border-border rounded-2xl p-4">
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

      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 mt-6">Home page</h2>
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-muted">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">Show Focus section</p>
            <p className="text-sm text-muted-foreground">
              Show the AI-generated Focus summary card on the home page.
            </p>
          </div>
          {!showFocusSectionLoading && (
            <button
              type="button"
              onClick={toggleShowFocusSection}
              disabled={showFocusSectionBusy}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${showFocusSection ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${showFocusSection ? 'translate-x-5' : ''}`} />
            </button>
          )}
        </div>

        {!defaultFocusPeriodLoading && (
          <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-border">
            <p className="text-sm font-medium">Default Focus tab</p>
            <Tabs value={defaultFocusPeriod} onValueChange={v => handleDefaultFocusPeriodChange(v as 'today' | 'week')}>
              <TabsList>
                <TabsTrigger value="today">Tomorrow</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 mt-6">Bottom navigation</h2>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Choose which pages appear next to Home in the bottom navigation bar. Everything else moves into "More".
        </p>
        {!bottomNavLoading && (
          <div className="space-y-2">
            {bottomNavItems.map((key, index) => (
              <Select key={index} value={key} onValueChange={v => handleBottomNavSlotChange(index, v as NavItemKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_NAV_KEYS.filter(k => k === key || !bottomNavItems.includes(k)).map(k => (
                    <SelectItem key={k} value={k}>{NAV_ITEMS[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 mt-6">Focus summaries</h2>
      {([
        { period: 'today', title: 'Tomorrow summary', tab: 'the "Tomorrow" Focus tab' },
        { period: 'week', title: 'Weekly summary', tab: 'the "This Week" Focus tab' },
      ] as const).map(({ period, title, tab }, i) => (
        <div key={period} className={`bg-card border border-border rounded-2xl p-4 ${i > 0 ? 'mt-4' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-muted">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">{title}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Daily refresh</p>
              <p className="text-sm text-muted-foreground">
                Automatically refresh {tab} once daily. Turn off to save API usage — you can still
                refresh it manually anytime.
              </p>
            </div>
            {!focusDailyLoading && (
              <ToggleSwitch
                checked={autoGenerateFocusDaily[period]}
                disabled={focusDailyBusy[period]}
                onChange={() => toggleAutoGenerateFocusDaily(period)}
              />
            )}
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Refresh on todo/event changes</p>
              <p className="text-sm text-muted-foreground">
                Automatically refresh {tab} when todos or events change. Turn off to save API usage —
                you can still refresh it manually anytime.
              </p>
            </div>
            {!focusOnChangeLoading && (
              <ToggleSwitch
                checked={autoGenerateFocusOnChange[period]}
                disabled={focusOnChangeBusy[period]}
                onChange={() => toggleAutoGenerateFocusOnChange(period)}
              />
            )}
          </div>
        </div>
      ))}

      {userId && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 mt-6">Voice shortcuts</h2>
          <VoiceShortcutsSection userId={userId} />
        </>
      )}
    </div>
  )
}
