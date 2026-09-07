import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Plus, RefreshCw, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover'
import { CURRENCIES, fetchRates, type CurrencyCode } from './currency'
import { supabase } from '../../supabase'
import type { CurrencyAlert } from '../../supabase'

const STORAGE_KEY = 'finance.currencyRows'
const OPERATORS = ['+', '-', '×', '÷'] as const
type Operator = typeof OPERATORS[number]

function currencyInfo(code: CurrencyCode) {
  return CURRENCIES.find(c => c.code === code)!
}

function lastNumber(expr: string): string {
  for (let i = expr.length - 1; i >= 0; i--) {
    if ((OPERATORS as readonly string[]).includes(expr[i])) return expr.slice(i + 1)
  }
  return expr
}

function appendDigit(expr: string, digit: string): string {
  if (expr.length > 17) return expr
  const cur = lastNumber(expr)
  if (cur === '0') return expr.slice(0, -1) + digit
  return expr + digit
}

function appendDecimal(expr: string): string {
  const cur = lastNumber(expr)
  if (cur.includes('.')) return expr
  if (cur === '') return expr + '0.'
  return expr + '.'
}

function appendOperator(expr: string, op: Operator): string {
  if (expr === '') return expr
  const last = expr[expr.length - 1]
  if ((OPERATORS as readonly string[]).includes(last)) return expr.slice(0, -1) + op
  return expr + op
}

function evalExpression(expr: string): number {
  const tokens = expr.match(/(\d+\.?\d*)|[+\-×÷]/g)
  if (!tokens || tokens.length === 0) return 0
  let result = parseFloat(tokens[0]) || 0
  for (let i = 1; i < tokens.length - 1; i += 2) {
    const op = tokens[i]
    const next = parseFloat(tokens[i + 1])
    if (Number.isNaN(next)) break
    if (op === '+') result += next
    else if (op === '-') result -= next
    else if (op === '×') result *= next
    else if (op === '÷') result = next !== 0 ? result / next : result
  }
  return result
}

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function loadStoredRows(): { base: CurrencyCode; others: CurrencyCode[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.base && Array.isArray(parsed?.others)) {
        return { base: parsed.base, others: parsed.others }
      }
    }
  } catch {
    // ignore malformed storage
  }
  return { base: 'usd', others: ['eur', 'ils', 'gbp'] }
}

export default function CurrencyConverter() {
  const initial = useMemo(loadStoredRows, [])
  const [baseCode, setBaseCode] = useState<CurrencyCode>(initial.base)
  const [otherCodes, setOtherCodes] = useState<CurrencyCode[]>(initial.others)
  const [expression, setExpression] = useState('1')
  // True until the first edit: lets the preset "1" (or a value carried over
  // from promoteToBase) be replaced by the next keystroke instead of appended to.
  const pristineRef = useRef(true)

  const [rates, setRates] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [alertsByCode, setAlertsByCode] = useState<Record<string, CurrencyAlert>>({})

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ base: baseCode, others: otherCodes }))
  }, [baseCode, otherCodes])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchRates(baseCode)
      .then(r => { if (!cancelled) { setRates(r); setLastUpdated(new Date()) } })
      .catch(() => { if (!cancelled) setError('Could not load exchange rate') })
      .finally(() => { if (!cancelled) setLoading(false) })
    setAlertsByCode({})
    return () => { cancelled = true }
  }, [baseCode])

  function refresh() {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchRates(baseCode)
      .then(r => { if (!cancelled) { setRates(r); setLastUpdated(new Date()) } })
      .catch(() => { if (!cancelled) setError('Could not load exchange rate') })
      .finally(() => { if (!cancelled) setLoading(false) })
  }

  function typeDigit(d: string) {
    const wasPristine = pristineRef.current
    pristineRef.current = false
    setExpression(expr => (wasPristine ? d : appendDigit(expr, d)))
  }
  function typeDecimal() {
    const wasPristine = pristineRef.current
    pristineRef.current = false
    setExpression(expr => (wasPristine ? '0.' : appendDecimal(expr)))
  }
  function typeOperator(op: Operator) {
    setExpression(expr => appendOperator(expr, op))
    pristineRef.current = false
  }
  function typeBackspace() {
    setExpression(expr => expr.slice(0, -1))
    pristineRef.current = false
  }
  function typeClear() {
    setExpression('')
    pristineRef.current = false
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key >= '0' && e.key <= '9') { typeDigit(e.key); e.preventDefault() }
      else if (e.key === '.') { typeDecimal(); e.preventDefault() }
      else if (e.key === '+') { typeOperator('+'); e.preventDefault() }
      else if (e.key === '-') { typeOperator('-'); e.preventDefault() }
      else if (e.key === '*') { typeOperator('×'); e.preventDefault() }
      else if (e.key === '/') { typeOperator('÷'); e.preventDefault() }
      else if (e.key === 'Backspace') { typeBackspace(); e.preventDefault() }
      else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') { typeClear(); e.preventDefault() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  async function ensureAlert(to: CurrencyCode): Promise<CurrencyAlert | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    let { data } = await supabase
      .from('currency_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('from_currency', baseCode)
      .eq('to_currency', to)
      .maybeSingle()
    if (!data) {
      const { data: created } = await supabase
        .from('currency_alerts')
        .insert({ user_id: user.id, from_currency: baseCode, to_currency: to })
        .select()
        .single()
      data = created
    }
    return data
  }

  async function openAlert(code: CurrencyCode) {
    if (alertsByCode[code]) return
    const alert = await ensureAlert(code)
    if (alert) setAlertsByCode(a => ({ ...a, [code]: alert }))
  }

  async function saveAlert(code: CurrencyCode, targetRate: number, direction: 'above' | 'below') {
    const alert = alertsByCode[code]
    if (!alert || Number.isNaN(targetRate)) return
    const { data } = await supabase
      .from('currency_alerts')
      .update({ target_rate: targetRate, direction, triggered_at: null })
      .eq('id', alert.id)
      .select()
      .single()
    if (data) setAlertsByCode(a => ({ ...a, [code]: data }))
  }

  function promoteToBase(code: CurrencyCode) {
    if (!rates) return
    const value = evalExpression(expression) * rates[code]
    setOtherCodes(codes => codes.map(c => (c === code ? baseCode : c)))
    setBaseCode(code)
    setExpression((Number.isFinite(value) ? value : 0).toFixed(2))
    pristineRef.current = true
  }

  function changeBase(newCode: CurrencyCode) {
    setOtherCodes(codes => {
      const next = codes.filter(c => c !== newCode)
      return next.includes(baseCode) ? next : [...next, baseCode]
    })
    setBaseCode(newCode)
  }

  function addCurrency(code: CurrencyCode) {
    setOtherCodes(codes => (codes.includes(code) ? codes : [...codes, code]))
  }

  function removeCurrency(code: CurrencyCode) {
    setOtherCodes(codes => codes.filter(c => c !== code))
  }

  function changeRowCurrency(oldCode: CurrencyCode, newCode: CurrencyCode) {
    setOtherCodes(codes => codes.map(c => (c === oldCode ? newCode : c)))
  }

  const availableToAdd = CURRENCIES.filter(c => c.code !== baseCode && !otherCodes.includes(c.code))
  const baseInfo = currencyInfo(baseCode)
  const total = evalExpression(expression)

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border text-xs text-muted-foreground">
        <span>
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
            : error
              ? 'Rates unavailable'
              : 'Loading rates…'}
        </span>
        <button
          onClick={refresh}
          type="button"
          className="p-1 rounded-md hover:bg-accent"
          title="Refresh rates"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-sm text-destructive text-center py-2 px-4">{error}</p>}

      <div className="divide-y divide-border">
        <div className="flex items-center gap-2 px-4 py-3 bg-primary/10">
          <Select value={baseCode} onValueChange={changeBase}>
            <SelectTrigger className="w-24 shrink-0 border-none bg-transparent h-auto py-1 px-2 font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="text-lg leading-none">{baseInfo.flag}</span>
                <SelectValue>{baseInfo.label}</SelectValue>
              </span>
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => (
                <SelectItem key={c.code} value={c.code}>{c.flag} {c.label} — {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1 min-w-0 text-right">
            <span className="text-2xl font-bold tabular-nums break-all">{expression === '' ? '0' : expression}</span>
          </div>
        </div>

        {otherCodes.map(code => {
          const info = currencyInfo(code)
          const rate = rates?.[code]
          const converted = rate !== undefined ? total * rate : null
          const alert = alertsByCode[code]
          return (
            <div key={code} className="flex items-center gap-2 px-4 py-3">
              <Select value={code} onValueChange={(v: CurrencyCode) => changeRowCurrency(code, v)}>
                <SelectTrigger className="w-24 shrink-0 border-none bg-transparent h-auto py-1 px-2 text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">
                  <span className="flex items-center gap-1.5">
                    <span className="text-lg leading-none">{info.flag}</span>
                    <SelectValue>{info.label}</SelectValue>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.filter(c => c.code === code || (c.code !== baseCode && !otherCodes.includes(c.code))).map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.label} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => promoteToBase(code)}
                className="flex-1 min-w-0 text-right text-lg font-medium tabular-nums hover:text-primary"
                title={`Make ${info.label} the base currency`}
              >
                {loading ? '···' : converted !== null ? formatAmount(converted) : '—'}
              </button>

              <Popover onOpenChange={open => open && openAlert(code)}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg hover:bg-accent shrink-0"
                    title="Set rate alert"
                  >
                    <Bell className={`h-4 w-4 ${alert?.triggered_at ? 'text-primary' : 'text-muted-foreground'}`} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3">
                  <AlertForm
                    baseLabel={baseInfo.label}
                    toLabel={info.label}
                    alert={alert}
                    onSave={(rate, dir) => saveAlert(code, rate, dir)}
                  />
                </PopoverContent>
              </Popover>

              <button
                type="button"
                onClick={() => removeCurrency(code)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground shrink-0"
                title={`Remove ${info.label}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}

        {availableToAdd.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                Add currency
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 max-h-64 overflow-y-auto p-1">
              {availableToAdd.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => addCurrency(c.code)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-accent text-left"
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  {c.label} — {c.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>

      <Keypad
        onDigit={typeDigit}
        onDecimal={typeDecimal}
        onOperator={typeOperator}
        onBackspace={typeBackspace}
        onClear={typeClear}
      />
    </div>
  )
}

function Keypad({
  onDigit,
  onDecimal,
  onOperator,
  onBackspace,
  onClear,
}: {
  onDigit: (d: string) => void
  onDecimal: () => void
  onOperator: (op: Operator) => void
  onBackspace: () => void
  onClear: () => void
}) {
  const keyClass = 'h-11 rounded-lg text-base font-medium hover:brightness-95 active:brightness-90 transition'
  return (
    <div className="border-t border-border p-3 bg-muted/40">
      <div className="grid grid-cols-5 gap-2">
        {(['7', '8', '9'] as const).map(d => (
          <button key={d} type="button" onClick={() => onDigit(d)} className={`${keyClass} col-span-1 bg-background`}>{d}</button>
        ))}
        <button type="button" onClick={() => onOperator('÷')} className={`${keyClass} bg-secondary text-secondary-foreground`}>÷</button>
        <button type="button" onClick={onBackspace} className={`${keyClass} bg-secondary text-secondary-foreground`}>⌫</button>

        {(['4', '5', '6'] as const).map(d => (
          <button key={d} type="button" onClick={() => onDigit(d)} className={`${keyClass} bg-background`}>{d}</button>
        ))}
        <button type="button" onClick={() => onOperator('×')} className={`${keyClass} bg-secondary text-secondary-foreground`}>×</button>
        <button type="button" onClick={onClear} className={`${keyClass} bg-destructive/10 text-destructive`}>C</button>

        {(['1', '2', '3'] as const).map(d => (
          <button key={d} type="button" onClick={() => onDigit(d)} className={`${keyClass} bg-background`}>{d}</button>
        ))}
        <button type="button" onClick={() => onOperator('-')} className={`${keyClass} bg-secondary text-secondary-foreground`}>−</button>
        <button type="button" onClick={() => onOperator('+')} className={`${keyClass} bg-secondary text-secondary-foreground row-span-1`}>+</button>

        <button type="button" onClick={() => onDigit('0')} className={`${keyClass} col-span-2 bg-background`}>0</button>
        <button type="button" onClick={onDecimal} className={`${keyClass} bg-background`}>.</button>
        <div className="col-span-2" />
      </div>
    </div>
  )
}

function AlertForm({
  baseLabel,
  toLabel,
  alert,
  onSave,
}: {
  baseLabel: string
  toLabel: string
  alert: CurrencyAlert | null | undefined
  onSave: (targetRate: number, direction: 'above' | 'below') => void
}) {
  const [targetInput, setTargetInput] = useState(alert ? String(alert.target_rate) : '')
  const [direction, setDirection] = useState<'above' | 'below'>(alert?.direction ?? 'above')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTargetInput(alert ? String(alert.target_rate) : '')
    setDirection(alert?.direction ?? 'above')
  }, [alert])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(parseFloat(targetInput), direction)
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="text-xs text-muted-foreground">Notify when 1 {baseLabel} is</p>
      <div className="flex items-center gap-1.5">
        <Select value={direction} onValueChange={(v: 'above' | 'below') => setDirection(v)}>
          <SelectTrigger className="w-24 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="above">above</SelectItem>
            <SelectItem value="below">below</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="number"
          step="0.0001"
          min="0"
          inputMode="decimal"
          value={targetInput}
          onChange={e => setTargetInput(e.target.value)}
          className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{toLabel}</span>
        <button
          type="submit"
          disabled={saving || !alert}
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </form>
  )
}
