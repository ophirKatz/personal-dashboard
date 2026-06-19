import { useEffect, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { CURRENCIES, fetchRate, type CurrencyCode } from './currency'

export default function CurrencyConverter() {
  const [amount, setAmount] = useState('1')
  const [from, setFrom] = useState<CurrencyCode>('usd')
  const [to, setTo] = useState<CurrencyCode>('ils')
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchRate(from, to)
      .then(r => { if (!cancelled) setRate(r) })
      .catch(() => { if (!cancelled) setError('Could not load exchange rate') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [from, to])

  function swap() {
    setFrom(to)
    setTo(from)
  }

  const numericAmount = parseFloat(amount) || 0
  const converted = rate !== null ? numericAmount * rate : null
  const fromInfo = CURRENCIES.find(c => c.code === from)!
  const toInfo = CURRENCIES.find(c => c.code === to)!

  return (
    <div className="p-4 bg-card border border-border rounded-xl space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Amount</label>
        <Input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select value={from} onValueChange={(v: CurrencyCode) => setFrom(v)}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(c => (
              <SelectItem key={c.code} value={c.code}>{c.label} — {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={swap}
          type="button"
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground shrink-0"
          title="Swap currencies"
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
        <Select value={to} onValueChange={(v: CurrencyCode) => setTo(v)}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(c => (
              <SelectItem key={c.code} value={c.code}>{c.label} — {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2 border-t border-border">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive text-center py-2">{error}</p>
        ) : (
          <div className="text-center py-2">
            <p className="text-3xl font-bold">{toInfo.symbol}{converted?.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              1 {fromInfo.label} = {rate?.toFixed(4)} {toInfo.label}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
