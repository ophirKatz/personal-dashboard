import { useEffect, useState } from 'react'
import { fetchRate } from './currency'
import { fetchQuote } from './stocks'

type SummaryItem = {
  key: string
  label: string
  fetcher: () => Promise<string>
}

const SUMMARY_ITEMS: SummaryItem[] = [
  {
    key: 'usd-ils',
    label: 'USD → NIS',
    fetcher: async () => `₪${(await fetchRate('usd', 'ils')).toFixed(4)}`,
  },
  {
    key: 'eur-ils',
    label: 'EUR → NIS',
    fetcher: async () => `₪${(await fetchRate('eur', 'ils')).toFixed(4)}`,
  },
  {
    key: 'tenb',
    label: 'TENB',
    fetcher: async () => `$${(await fetchQuote('TENB')).current.toFixed(2)}`,
  },
]

type ItemState = { value?: string; error?: boolean }

export default function FinanceSummary() {
  const [states, setStates] = useState<Record<string, ItemState>>({})

  useEffect(() => {
    SUMMARY_ITEMS.forEach(item => {
      item.fetcher()
        .then(value => setStates(s => ({ ...s, [item.key]: { value } })))
        .catch(() => setStates(s => ({ ...s, [item.key]: { error: true } })))
    })
  }, [])

  return (
    <div className="mb-6 grid grid-cols-3 gap-3">
      {SUMMARY_ITEMS.map(item => {
        const state = states[item.key]
        return (
          <div key={item.key} className="p-3 bg-card border border-border rounded-xl">
            <p className="text-xs text-muted-foreground truncate">{item.label}</p>
            <p className="text-base font-semibold mt-0.5 truncate">
              {state?.error ? '—' : state?.value ?? (
                <span className="inline-block h-4 w-12 bg-muted rounded animate-pulse" />
              )}
            </p>
          </div>
        )
      })}
    </div>
  )
}
