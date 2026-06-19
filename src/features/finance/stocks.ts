export type StockQuote = {
  current: number
  change: number
  percentChange: number
  high: number
  low: number
  open: number
  previousClose: number
}

export async function fetchQuote(symbol: string): Promise<StockQuote> {
  const res = await fetch(`/api/stock-quote?symbol=${encodeURIComponent(symbol)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'UPSTREAM_ERROR')
  return data
}
