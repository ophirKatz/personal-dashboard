import { useEffect, useState } from 'react'
import { ArrowUpDown, Bell } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { CURRENCIES, fetchRate, type CurrencyCode } from './currency'
import { supabase } from '../../supabase'
import type { CurrencyAlert } from '../../supabase'

export default function CurrencyConverter() {
  const [amount, setAmount] = useState('1')
  const [from, setFrom] = useState<CurrencyCode>('usd')
  const [to, setTo] = useState<CurrencyCode>('ils')
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [alert, setAlert] = useState<CurrencyAlert | null>(null)
  const [targetInput, setTargetInput] = useState('')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [savingAlert, setSavingAlert] = useState(false)

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

  useEffect(() => {
    let cancelled = false
    async function loadAlert() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      let { data } = await supabase
        .from('currency_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('from_currency', from)
        .eq('to_currency', to)
        .maybeSingle()
      if (!data) {
        const { data: created } = await supabase
          .from('currency_alerts')
          .insert({ user_id: user.id, from_currency: from, to_currency: to })
          .select()
          .single()
        data = created
      }
      if (cancelled) return
      setAlert(data)
      setTargetInput(data ? String(data.target_rate) : '')
      setDirection(data ? data.direction : 'above')
    }
    loadAlert()
    return () => { cancelled = true }
  }, [from, to])

  async function saveAlert(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(targetInput)
    if (!alert || Number.isNaN(value)) return
    setSavingAlert(true)
    const { data } = await supabase
      .from('currency_alerts')
      .update({ target_rate: value, direction, triggered_at: null })
      .eq('id', alert.id)
      .select()
      .single()
    setAlert(data)
    setSavingAlert(false)
  }

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

      <form onSubmit={saveAlert} className="space-y-2 pt-2 border-t border-border">
        <label htmlFor="currency-alert-target" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Bell className={`h-4 w-4 shrink-0 ${alert?.triggered_at ? 'text-primary' : 'text-muted-foreground'}`} />
          Notify when 1 {fromInfo.label} is
        </label>
        <div className="flex items-center gap-2">
          <Select value={direction} onValueChange={(v: 'above' | 'below') => setDirection(v)}>
            <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="above">above</SelectItem>
              <SelectItem value="below">below</SelectItem>
            </SelectContent>
          </Select>
          <Input
            id="currency-alert-target"
            type="number"
            step="0.0001"
            min="0"
            inputMode="decimal"
            value={targetInput}
            onChange={e => setTargetInput(e.target.value)}
            className="flex-1 min-w-0"
          />
          <span className="text-sm text-muted-foreground shrink-0">{toInfo.label}</span>
          <button
            type="submit"
            disabled={savingAlert || !alert}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 shrink-0"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
