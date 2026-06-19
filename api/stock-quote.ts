import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'MISSING_API_KEY' })
    return
  }

  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : 'TENB'

  let upstream: Response
  try {
    upstream = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`)
  } catch {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  if (!upstream.ok) {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  const data = await upstream.json()
  if (data.c === 0 && data.h === 0 && data.l === 0) {
    res.status(404).json({ error: 'NOT_FOUND' })
    return
  }

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
  res.status(200).json({
    current: data.c,
    change: data.d,
    percentChange: data.dp,
    high: data.h,
    low: data.l,
    open: data.o,
    previousClose: data.pc,
  })
}
