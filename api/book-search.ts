import type { VercelRequest, VercelResponse } from '@vercel/node'

const FIELDS = 'key,title,author_name,first_publish_year,cover_i'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) {
    res.status(400).json({ error: 'MISSING_QUERY' })
    return
  }

  let upstream: Response
  try {
    upstream = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20&fields=${FIELDS}`,
      { headers: { 'User-Agent': 'personal-dashboard (reading list)' } },
    )
  } catch {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  if (!upstream.ok) {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  const data = await upstream.json()
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
  res.status(200).json({ docs: data.docs ?? [] })
}
