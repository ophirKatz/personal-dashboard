export const CURRENCIES = [
  { code: 'usd', label: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'eur', label: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'ils', label: 'NIS', name: 'Israeli Shekel', symbol: '₪', flag: '🇮🇱' },
  { code: 'gbp', label: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'jpy', label: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'chf', label: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
  { code: 'cad', label: 'CAD', name: 'Canadian Dollar', symbol: '$', flag: '🇨🇦' },
  { code: 'aud', label: 'AUD', name: 'Australian Dollar', symbol: '$', flag: '🇦🇺' },
  { code: 'try', label: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'all', label: 'ALL', name: 'Albanian Lek', symbol: 'L', flag: '🇦🇱' },
] as const

export type CurrencyCode = typeof CURRENCIES[number]['code']

const primaryUrl = (base: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`
const fallbackUrl = (base: string) => `https://latest.currency-api.pages.dev/v1/currencies/${base}.json`

export async function fetchRates(base: CurrencyCode): Promise<Record<string, number>> {
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
