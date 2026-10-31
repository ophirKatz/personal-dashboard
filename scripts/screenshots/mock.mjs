// Network-level stand-in for Supabase + the app's external APIs, used only for
// taking screenshots. Nothing in the repo is modified: the page gets a fake
// session in localStorage and every backend request is answered from `store`.

const HOST = 'placeholder.supabase.co'
export const USER = { id: '00000000-0000-4000-8000-000000000001', email: 'ophir@example.com' }

let idCounter = 1000
const newId = () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`

// ---- PostgREST filter engine (the subset the app uses) ----------------------

function coerce(rowVal, raw) {
  if (raw === 'null') return null
  if (typeof rowVal === 'number') return Number(raw)
  if (typeof rowVal === 'boolean') return raw === 'true'
  return raw
}

function cmp(a, b) {
  if (a == null || b == null) return a == null ? (b == null ? 0 : -1) : 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

function likeToRegex(pattern, flags) {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${esc}$`, flags)
}

function testCondition(row, col, expr) {
  let negate = false
  let e = expr
  if (e.startsWith('not.')) { negate = true; e = e.slice(4) }
  const dot = e.indexOf('.')
  const op = e.slice(0, dot)
  const raw = e.slice(dot + 1)
  const v = row[col]
  let ok
  switch (op) {
    case 'eq': ok = v == null ? raw === 'null' : v === coerce(v, raw); break
    case 'neq': ok = v !== coerce(v, raw); break
    case 'gt': ok = v != null && cmp(v, coerce(v, raw)) > 0; break
    case 'gte': ok = v != null && cmp(v, coerce(v, raw)) >= 0; break
    case 'lt': ok = v != null && cmp(v, coerce(v, raw)) < 0; break
    case 'lte': ok = v != null && cmp(v, coerce(v, raw)) <= 0; break
    case 'is': ok = raw === 'null' ? v == null : v === (raw === 'true'); break
    case 'like': ok = v != null && likeToRegex(raw, '').test(String(v)); break
    case 'ilike': ok = v != null && likeToRegex(raw, 'i').test(String(v)); break
    case 'in': {
      const list = raw.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''))
      ok = list.some(x => String(v) === x)
      break
    }
    case 'cs': ok = Array.isArray(v) && raw.replace(/^\{|\}$/g, '').split(',').every(x => v.includes(x)); break
    default: ok = true
  }
  return negate ? !ok : ok
}

// "(a.eq.1,b.is.null)" -> list of [col, expr]; no nested groups needed by the app.
function parseOrList(s) {
  const inner = s.replace(/^\(|\)$/g, '')
  const parts = []
  let depth = 0, cur = ''
  for (const ch of inner) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  if (cur) parts.push(cur)
  return parts.map(p => {
    const i = p.indexOf('.')
    return [p.slice(0, i), p.slice(i + 1)]
  })
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'])

function applyFilters(rows, params) {
  let out = rows
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue
    if (key === 'or') {
      const conds = parseOrList(value)
      out = out.filter(r => conds.some(([c, e]) => testCondition(r, c, e)))
    } else if (key === 'and') {
      const conds = parseOrList(value)
      out = out.filter(r => conds.every(([c, e]) => testCondition(r, c, e)))
    } else {
      out = out.filter(r => testCondition(r, key, value))
    }
  }
  const order = params.get('order')
  if (order) {
    const specs = order.split(',').map(s => {
      const [col, dir] = s.split('.')
      return { col, desc: dir === 'desc' }
    })
    // Postgres default: NULLS LAST for ascending, NULLS FIRST for descending.
    out = [...out].sort((a, b) => {
      for (const { col, desc } of specs) {
        const an = a[col] == null, bn = b[col] == null
        if (an || bn) { if (an && bn) continue; return an ? (desc ? -1 : 1) : (desc ? 1 : -1) }
        const c = cmp(a[col], b[col])
        if (c !== 0) return desc ? -c : c
      }
      return 0
    })
  }
  const offset = params.get('offset')
  if (offset) out = out.slice(Number(offset))
  const limit = params.get('limit')
  if (limit) out = out.slice(0, Number(limit))
  return out
}

// ---- Route installation -------------------------------------------------------

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
  'access-control-expose-headers': 'content-range, content-type',
}

function json(route, status, body, extra = {}) {
  return route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json', ...extra },
    body: body === undefined ? '' : JSON.stringify(body),
  })
}

const PALETTE = ['#f97316', '#10b981', '#6366f1', '#ec4899', '#0ea5e9', '#eab308', '#8b5cf6', '#ef4444']
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

function svgImage(label, w = 300, h = 450) {
  const c1 = PALETTE[hash(label) % PALETTE.length]
  const c2 = PALETTE[(hash(label) >> 3) % PALETTE.length]
  const short = label.length > 28 ? label.slice(0, 26) + '…' : label
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<text x="${w / 2}" y="${h / 2}" font-family="sans-serif" font-size="${Math.round(w / 12)}" fill="white" text-anchor="middle" font-weight="bold">${short.replace(/&/g, '&amp;')}</text></svg>`
}

/**
 * @param context Playwright BrowserContext
 * @param store   { [table]: row[] } — mutated by inserts/updates/deletes
 * @param opts    { functions, rpc, external, delayMs, failTables, log }
 */
export async function installMock(context, store, opts = {}) {
  const { functions = {}, rpc = {}, external = {}, delayMs = {}, failTables = [] } = opts
  const requests = []

  await context.route(url => url.hostname === HOST, async route => {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    requests.push(`${method} ${url.pathname}${url.search}`)

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          ...CORS,
          'access-control-allow-headers': req.headers()['access-control-request-headers'] ?? '*',
          'access-control-max-age': '600',
        },
      })
    }

    // ---- auth
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/user')) return json(route, 200, { ...fakeUser() })
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: CORS })
      if (url.pathname.endsWith('/token')) return json(route, 200, fakeSession())
      return json(route, 200, {})
    }

    // ---- edge functions
    if (url.pathname.startsWith('/functions/v1/')) {
      const name = url.pathname.split('/').pop()
      const handler = functions[name]
      if (handler === 'fail') return json(route, 500, { error: 'mock failure' })
      const body = typeof handler === 'function' ? await handler(req) : handler ?? {}
      return json(route, 200, body)
    }

    // ---- storage (public object URLs + list/sign)
    if (url.pathname.startsWith('/storage/v1/')) {
      const m = url.pathname.match(/\/object\/(?:public\/|sign\/)?([^/]+)\/(.+)$/)
      if (m && req.method() === 'GET') {
        const label = decodeURIComponent(m[2]).split('/').pop().replace(/\.[a-z]+$/i, '')
        return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/svg+xml' }, body: svgImage(label, 600, 450) })
      }
      return json(route, 200, [])
    }

    // ---- REST
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').pop()
      const handler = rpc[name]
      if (handler === undefined) return json(route, 200, null)
      const payload = req.postData() ? JSON.parse(req.postData()) : {}
      const out = typeof handler === 'function' ? await handler(payload, store) : handler
      return json(route, 200, out)
    }

    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.replace('/rest/v1/', '')
      if (delayMs[table]) await new Promise(r => setTimeout(r, delayMs[table]))
      if (failTables.includes(table)) {
        return json(route, 500, { code: 'XX000', message: 'mock table failure', details: null, hint: null })
      }
      if (!(table in store)) store[table] = []
      const rows = store[table]
      const accept = req.headers()['accept'] ?? ''
      const wantsObject = accept.includes('vnd.pgrst.object')
      const prefer = req.headers()['prefer'] ?? ''
      const wantsRepr = prefer.includes('return=representation')

      const respondRows = (list, status = 200) => {
        if (wantsObject) {
          if (list.length !== 1) {
            return json(route, 406, { code: 'PGRST116', details: `The result contains ${list.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' })
          }
          return json(route, status, list[0])
        }
        return json(route, status, list)
      }

      if (method === 'GET' || method === 'HEAD') {
        const filtered = applyFilters(rows, url.searchParams)
        const total = filtered.length
        if (method === 'HEAD') {
          return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `*/${total}` } })
        }
        const hdr = prefer.includes('count=') ? { 'content-range': `0-${Math.max(total - 1, 0)}/${total}` } : {}
        if (wantsObject) return respondRows(filtered)
        return json(route, 200, filtered, hdr)
      }

      if (method === 'POST') {
        const body = JSON.parse(req.postData() || '[]')
        const incoming = Array.isArray(body) ? body : [body]
        const conflict = url.searchParams.get('on_conflict')?.split(',')
        const merge = prefer.includes('resolution=merge-duplicates')
        const ignore = prefer.includes('resolution=ignore-duplicates')
        const out = []
        for (const item of incoming) {
          let existing = null
          if (conflict && (merge || ignore)) {
            existing = rows.find(r => conflict.every(c => r[c] === item[c] || (item[c] === undefined && c === 'user_id')))
          } else if (merge && item.id) {
            existing = rows.find(r => r.id === item.id)
          } else if (merge && table === 'user_settings') {
            existing = rows.find(r => r.user_id === item.user_id)
          }
          if (existing) {
            if (merge) Object.assign(existing, item)
            out.push(existing)
          } else {
            const row = { id: newId(), user_id: USER.id, created_at: new Date().toISOString(), ...item }
            rows.push(row)
            out.push(row)
          }
        }
        if (!wantsRepr) return route.fulfill({ status: 201, headers: CORS })
        return respondRows(out, 201)
      }

      if (method === 'PATCH') {
        const patch = JSON.parse(req.postData() || '{}')
        const hit = applyFilters(rows, url.searchParams)
        hit.forEach(r => Object.assign(r, patch))
        if (!wantsRepr) return route.fulfill({ status: 204, headers: CORS })
        return respondRows(hit)
      }

      if (method === 'DELETE') {
        const hit = new Set(applyFilters(rows, url.searchParams))
        store[table] = rows.filter(r => !hit.has(r))
        return route.fulfill({ status: 204, headers: CORS })
      }
    }

    return json(route, 404, { message: 'not mocked' })
  })

  // ---- everything else off-box: serve canned data or fail fast (no proxy waits)
  await context.route(url => !['localhost', '127.0.0.1', HOST].includes(url.hostname), async route => {
    const url = new URL(route.request().url())
    requests.push(`EXT ${route.request().method()} ${url.hostname}${url.pathname}`)
    if (url.hostname === 'covers.openlibrary.org') {
      const id = url.pathname.split('/').pop().replace(/-[SML]\.jpg$/, '')
      const label = external.coverLabels?.[id] ?? `Book ${id}`
      return route.fulfill({ status: 200, headers: { 'content-type': 'image/svg+xml', ...CORS }, body: svgImage(label) })
    }
    if (url.hostname === 'runescape.wiki' && url.pathname.startsWith('/images')) {
      return route.fulfill({ status: 200, headers: { 'content-type': 'image/svg+xml', ...CORS }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#64748b"/><circle cx="20" cy="20" r="8" fill="#94a3b8"/></svg>' })
    }
    for (const [pattern, handler] of Object.entries(external)) {
      if (pattern === 'coverLabels') continue
      if (url.href.includes(pattern)) {
        const body = typeof handler === 'function' ? await handler(url) : handler
        return json(route, body?.__status ?? 200, body?.__status ? body.body : body)
      }
    }
    return route.abort('blockedbyclient')
  })

  // Same-origin /api/* routes are Vercel functions (not served by Vite).
  await context.route(url => url.hostname === 'localhost' && url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    requests.push(`API ${route.request().method()} ${url.pathname}${url.search}`)
    for (const [pattern, handler] of Object.entries(external)) {
      if (pattern.startsWith('/api/') && `${url.pathname}${url.search}`.includes(pattern)) {
        const body = typeof handler === 'function' ? await handler(url) : handler
        return json(route, body?.__status ?? 200, body?.__status ? body.body : body)
      }
    }
    return json(route, 404, { error: 'not mocked' })
  })

  return { requests }
}

export function fakeUser() {
  return {
    id: USER.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: USER.email,
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { full_name: 'Ophir' },
    created_at: '2025-01-01T00:00:00Z',
  }
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

export function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 5
  const jwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: USER.id, role: 'authenticated', exp })}.sig`
  return { access_token: jwt, refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: fakeUser() }
}

export async function signIn(context) {
  const session = JSON.stringify(fakeSession())
  await context.addInitScript(s => {
    try { localStorage.setItem('sb-placeholder-auth-token', s) } catch {}
  }, session)
}
