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
  const apiKey = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined
  if (!apiKey) throw new Error('MISSING_API_KEY')

  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`)
  if (!res.ok) throw new Error('Failed to fetch stock quote')
  const data = await res.json()

  if (data.c === 0 && data.h === 0 && data.l === 0) throw new Error(`No data for symbol "${symbol}"`)

  return {
    current: data.c,
    change: data.d,
    percentChange: data.dp,
    high: data.h,
    low: data.l,
    open: data.o,
    previousClose: data.pc,
  }
}
