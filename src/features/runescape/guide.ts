import DOMPurify from 'dompurify'
import { RsApiError } from './api'

const WIKI = 'https://runescape.wiki'

export type GuideVariant = 'quick' | 'full'

export type FactKey = 'start' | 'difficulty' | 'length' | 'requirements' | 'items' | 'recommended' | 'enemies' | 'rewards'

export type GuideFact = { key: FactKey; label: string; html: string }

export type GuideSection = { title: string; html: string }

export type Guide = {
  title: string
  url: string
  /** Quest-at-a-glance rows pulled from the infobox (or matching sections). */
  facts: GuideFact[]
  /** Everything else on the page, in order. */
  sections: GuideSection[]
}

const FACT_PATTERNS: [FactKey, RegExp][] = [
  ['start', /^start( point)?$/i],
  ['difficulty', /difficulty/i],
  ['length', /^length$/i],
  ['requirements', /^requirements?$/i],
  ['items', /^items? required$|^required items?$/i],
  ['recommended', /^recommended/i],
  ['enemies', /^enem(y|ies)/i],
  ['rewards', /^rewards?$/i],
]

const FACT_LABEL: Record<FactKey, string> = {
  start: 'Start point',
  difficulty: 'Difficulty',
  length: 'Length',
  requirements: 'Requirements',
  items: 'Items required',
  recommended: 'Recommended',
  enemies: 'Enemies to defeat',
  rewards: 'Rewards',
}

const FACT_ORDER = Object.keys(FACT_LABEL) as FactKey[]

/** Sections that are page furniture, not guide content. */
const SKIP_SECTION = /^(references?|external links?|see also|gallery|transcript|trivia|music|navigation)$/i

export function factKeyFor(label: string): FactKey | null {
  const clean = label.replace(/\s+/g, ' ').trim()
  return FACT_PATTERNS.find(([, re]) => re.test(clean))?.[0] ?? null
}

const text = (el: Element) => (el.textContent ?? '').replace(/\[edit( source)?\]/gi, '').replace(/\s+/g, ' ').trim()

function headingOf(el: Element): Element | null {
  if (el.matches('h2')) return el
  // Newer MediaWiki wraps headings: <div class="mw-heading mw-heading2"><h2>…</h2></div>
  if (el.matches('div.mw-heading')) return el.querySelector('h2')
  return null
}

function absolutize(root: Element) {
  root.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('#')) {
      // In-page anchors have nowhere to go here.
      a.replaceWith(...Array.from(a.childNodes))
      return
    }
    a.setAttribute('href', href.startsWith('//') ? `https:${href}` : href.startsWith('/') ? WIKI + href : href)
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
  })
  root.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') ?? ''
    if (src.startsWith('//')) img.setAttribute('src', `https:${src}`)
    else if (src.startsWith('/')) img.setAttribute('src', WIKI + src)
    // srcset entries are root-relative too; the plain src is enough.
    img.removeAttribute('srcset')
    img.setAttribute('loading', 'lazy')
    img.setAttribute('referrerpolicy', 'no-referrer')
  })
}

/** Turns the rendered HTML of a wiki page into structured, sanitized guide content. */
export function parseGuideHtml(html: string, pageTitle: string): Guide {
  const clean = DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'], FORBID_ATTR: ['style'] })
  const doc = new DOMParser().parseFromString(clean, 'text/html')
  const root = doc.querySelector('.mw-parser-output') ?? doc.body

  root
    .querySelectorAll('.mw-editsection, .navbox, table.navbox, .toc, #toc, sup.reference, .reference, .references, .mw-references-wrap, .noprint')
    .forEach(el => el.remove())
  absolutize(root)

  const facts = new Map<FactKey, GuideFact>()

  // Infobox: <table class="infobox …"><tr><th>Label</th><td>Value</td></tr>…
  const infobox = root.querySelector('table.infobox, table[class*="infobox"]')
  if (infobox) {
    infobox.querySelectorAll('tr').forEach(tr => {
      const th = tr.querySelector('th')
      const td = tr.querySelector('td')
      if (!th || !td) return
      const key = factKeyFor(text(th))
      if (!key || !text(td) || facts.has(key)) return
      facts.set(key, { key, label: FACT_LABEL[key], html: td.innerHTML })
    })
    if (facts.size > 0) infobox.remove()
  }

  // Sections: split the body at h2 headings; the first chunk is the intro.
  const sections: GuideSection[] = []
  let current: { title: string; parts: string[] } = { title: '', parts: [] }
  const flush = () => {
    const body = current.parts.join('')
    const holder = doc.createElement('div')
    holder.innerHTML = body
    if (text(holder) || holder.querySelector('img')) {
      const key = factKeyFor(current.title)
      // Pages without infobox rows still label these as headings ("Rewards", "Items required"…).
      if (key && !facts.has(key)) facts.set(key, { key, label: FACT_LABEL[key], html: body })
      else if (!SKIP_SECTION.test(current.title)) sections.push({ title: current.title, html: body })
    }
  }
  Array.from(root.children).forEach(el => {
    const h = headingOf(el)
    if (h) {
      flush()
      current = { title: text(h), parts: [] }
    } else {
      current.parts.push(el.outerHTML)
    }
  })
  flush()

  return {
    title: pageTitle,
    url: `${WIKI}/w/${encodeURIComponent(pageTitle.replace(/ /g, '_')).replace(/%2F/g, '/')}`,
    facts: FACT_ORDER.flatMap(k => (facts.has(k) ? [facts.get(k)!] : [])),
    sections,
  }
}

async function fetchPage(title: string, signal?: AbortSignal): Promise<Guide> {
  const res = await fetch(`/api/runescape?kind=wiki-page&title=${encodeURIComponent(title)}`, { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new RsApiError((body as { error?: 'NOT_FOUND' } | null)?.error ?? 'UPSTREAM_ERROR')
  }
  const data = (await res.json()) as { parse?: { title?: string; text?: string } }
  const html = data.parse?.text
  if (!html) throw new RsApiError('NOT_FOUND')
  return parseGuideHtml(html, data.parse?.title ?? title)
}

/** Full guide = the quest page; quick guide = its "/Quick guide" subpage (not every quest has one). */
export function fetchGuide(questName: string, variant: GuideVariant, signal?: AbortSignal): Promise<Guide> {
  return fetchPage(variant === 'quick' ? `${questName}/Quick guide` : questName, signal)
}
