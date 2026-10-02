import type { VercelRequest, VercelResponse } from '@vercel/node'

const UA = 'personal-dashboard (rs3 tracker)'
const PLAYER_RE = /^[A-Za-z0-9 _-]{1,12}$/

function upstreamUrl(kind: string, player: string): string | null {
  const p = encodeURIComponent(player)
  switch (kind) {
    case 'hiscores':
      return `https://secure.runescape.com/m=hiscore/index_lite.json?player=${p}`
    case 'profile':
      return `https://apps.runescape.com/runemetrics/profile/profile?user=${p}&activities=20`
    case 'quests':
      return `https://apps.runescape.com/runemetrics/quests?user=${p}`
    default:
      return null
  }
}

const WIKI_QUESTS =
  'https://runescape.wiki/api.php?action=query&list=categorymembers&cmtitle=Category:Quests&cmlimit=500&cmtype=page&format=json'

const wikiCategory = (name: string) =>
  `https://runescape.wiki/api.php?action=query&list=categorymembers&cmtitle=Category:${name}&cmlimit=500&cmtype=page&format=json`

// Rendered HTML of one wiki page (quest page or its "/Quick guide" subpage).
const TITLE_RE = /^[^|{}<>[\]#_]{1,120}$/
function wikiPageUrl(title: string): string {
  return (
    'https://runescape.wiki/api.php?action=parse&prop=text&format=json&formatversion=2&redirects=1' +
    `&disableeditsection=1&disabletoc=1&page=${encodeURIComponent(title)}`
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const kind = typeof req.query.kind === 'string' ? req.query.kind : ''
  const player = typeof req.query.player === 'string' ? req.query.player.trim() : ''
  const title = typeof req.query.title === 'string' ? req.query.title.trim() : ''

  let url: string | null
  if (kind === 'wiki-quests') {
    url = WIKI_QUESTS
  } else if (kind === 'wiki-miniquests') {
    url = wikiCategory('Miniquests')
  } else if (kind === 'wiki-sagas') {
    url = wikiCategory('Sagas')
  } else if (kind === 'wiki-page') {
    if (!TITLE_RE.test(title)) {
      res.status(400).json({ error: 'INVALID_TITLE' })
      return
    }
    url = wikiPageUrl(title)
  } else {
    if (!PLAYER_RE.test(player)) {
      res.status(400).json({ error: 'INVALID_PLAYER' })
      return
    }
    url = upstreamUrl(kind, player)
  }
  if (!url) {
    res.status(400).json({ error: 'INVALID_KIND' })
    return
  }

  let upstream: Response
  try {
    upstream = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  } catch {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  if (upstream.status === 404) {
    res.status(404).json({ error: 'NOT_FOUND' })
    return
  }
  if (!upstream.ok) {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  let data: unknown
  try {
    data = await upstream.json()
  } catch {
    // Hiscores answers 200 with an HTML/empty body for unknown players.
    res.status(404).json({ error: 'NOT_FOUND' })
    return
  }

  // RuneMetrics reports failures in a 200 body: { error: 'PROFILE_PRIVATE' | 'NO_PROFILE' | ... }
  const err = (data as { error?: unknown } | null)?.error
  if (typeof err === 'string') {
    const code = err === 'PROFILE_PRIVATE' ? 'PROFILE_PRIVATE' : err === 'NO_PROFILE' ? 'NOT_FOUND' : 'UPSTREAM_ERROR'
    res.status(code === 'NOT_FOUND' ? 404 : code === 'PROFILE_PRIVATE' ? 403 : 502).json({ error: code })
    return
  }

  if (kind === 'wiki-page') {
    // MediaWiki reports failures as { error: { code, info } } with a 200 status.
    const wikiErr = (data as { error?: { code?: string } } | null)?.error
    if (wikiErr) {
      const missing = wikiErr.code === 'missingtitle' || wikiErr.code === 'invalidtitle'
      res.status(missing ? 404 : 502).json({ error: missing ? 'NOT_FOUND' : 'UPSTREAM_ERROR' })
      return
    }
    // Guides change rarely; cache for a day.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    res.status(200).json(data)
    return
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
  res.status(200).json(data)
}
