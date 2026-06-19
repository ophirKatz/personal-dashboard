import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { fetchQuote, type StockQuote } from './stocks'

const SYMBOL = 'TENB'

export default function StockCard() {
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => { load() }, [])

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
