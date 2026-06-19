export const CURRENCIES = [
  { code: 'usd', label: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'eur', label: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'ils', label: 'NIS', name: 'Israeli Shekel', symbol: '₪' },
] as const

export type CurrencyCode = typeof CURRENCIES[number]['code']

const primaryUrl = (base: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`
const fallbackUrl = (base: string) => `https://latest.currency-api.pages.dev/v1/currencies/${base}.json`

async function fetchRates(base: CurrencyCode): Promise<Record<string, number>> {
  let res: Response
  try {
    res = await fetch(primaryUrl(base))
    if (!res.ok) throw new Error('primary failed')
  } catch {
    res = await fetch(fallbackUrl(base))
  }
  if (!res.ok) throw new Error('Failed to fetch exchange rates')
  const json = await res.json()
  return json[base]
}

export async function fetchRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  if (from === to) return 1
  const rates = await fetchRates(from)
  return rates[to]
}
