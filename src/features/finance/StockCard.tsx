import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Bell } from 'lucide-react'
import { fetchQuote, type StockQuote } from './stocks'
import { supabase } from '../../supabase'
import type { StockAlert } from '../../supabase'

const SYMBOL = 'TENB'

export default function StockCard() {
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [alert, setAlert] = useState<StockAlert | null>(null)
  const [targetInput, setTargetInput] = useState('')
  const [savingAlert, setSavingAlert] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setQuote(await fetchQuote(SYMBOL))
    } catch (e) {
      setError(e instanceof Error && e.message === 'MISSING_API_KEY' ? 'MISSING_API_KEY' : 'Could not load stock data')
    } finally {
      setLoading(false)
    }
  }

  async function loadAlert() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let { data } = await supabase.from('stock_alerts').select('*').eq('user_id', user.id).eq('symbol', SYMBOL).maybeSingle()
    if (!data) {
      const { data: created } = await supabase.from('stock_alerts').insert({ user_id: user.id, symbol: SYMBOL }).select().single()
      data = created
    }
    setAlert(data)
    setTargetInput(data ? String(data.target_price) : '')
  }

  useEffect(() => { load(); loadAlert() }, [])

  async function saveAlert(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(targetInput)
    if (!alert || Number.isNaN(value)) return
    setSavingAlert(true)
    const { data } = await supabase.from('stock_alerts').update({ target_price: value, triggered_at: null }).eq('id', alert.id).select().single()
    setAlert(data)
    setSavingAlert(false)
  }

  if (error === 'MISSING_API_KEY') {
    return (
      <div className="p-4 bg-card border border-border rounded-xl text-center text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Stock data needs an API key</p>
        <p>
          Get a free key at{' '}
          <a href="https://finnhub.io/register" target="_blank" rel="noreferrer" className="text-primary underline">
            finnhub.io
          </a>{' '}
          and set <code className="text-xs">VITE_FINNHUB_API_KEY</code>.
        </p>
      </div>
    )
  }

  const up = quote ? quote.change >= 0 : false

  return (
    <div className="p-4 bg-card border border-border rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{SYMBOL}</p>
          <p className="text-xs text-muted-foreground">Tenable Holdings, Inc.</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !quote ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive text-center py-4">{error}</p>
      ) : quote && (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${quote.current.toFixed(2)}</span>
            <span className={`flex items-center gap-0.5 text-sm font-medium ${up ? 'text-emerald-600' : 'text-destructive'}`}>
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {quote.change.toFixed(2)} ({quote.percentChange.toFixed(2)}%)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
            <Stat label="Open" value={quote.open} />
            <Stat label="Prev Close" value={quote.previousClose} />
            <Stat label="High" value={quote.high} />
            <Stat label="Low" value={quote.low} />
          </div>

          <form onSubmit={saveAlert} className="flex items-center gap-2 pt-2 border-t border-border">
            <Bell className={`h-4 w-4 shrink-0 ${alert?.triggered_at ? 'text-primary' : 'text-muted-foreground'}`} />
            <label htmlFor="stock-alert-target" className="text-sm text-muted-foreground shrink-0">Notify above $</label>
            <input
              id="stock-alert-target"
              type="number"
              step="0.01"
              min="0"
              value={targetInput}
              onChange={e => setTargetInput(e.target.value)}
              className="flex-1 h-9 px-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={savingAlert || !alert}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
            >
              Save
            </button>
          </form>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">${value.toFixed(2)}</p>
    </div>
  )
}
