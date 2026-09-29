// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { factKeyFor, parseGuideHtml } from './guide'

// Hand-written approximation of MediaWiki parse output for a quest page. The real markup
// hasn't been inspected (the dev sandbox can't reach the wiki), so keep the parser tolerant.
const PAGE = `
<div class="mw-parser-output">
  <table class="infobox infobox-quest">
    <tr><th colspan="2">Cook's Assistant</th></tr>
    <tr><th>Start point</th><td>Talk to the <a href="/w/Cook_(Lumbridge)">Cook</a> in Lumbridge Castle</td></tr>
    <tr><th>Official difficulty</th><td>Novice</td></tr>
    <tr><th>Requirements</th><td><ul><li>None</li></ul></td></tr>
    <tr><th>Items required</th><td><ul><li>Bucket of milk</li><li>Egg</li><li>Pot of flour</li></ul></td></tr>
    <tr><th>Rewards</th><td><ul><li>1 Quest point</li><li>300 Cooking experience</li></ul></td></tr>
  </table>
  <p>Intro text</p>
  <div class="mw-heading mw-heading2"><h2 id="Walkthrough">Walkthrough</h2></div>
  <p>Speak to the cook. <img src="/images/thumb/Egg.png/20px-Egg.png" srcset="/images/a.png 2x"><script>alert(1)</script></p>
  <ol><li>Get the egg</li><li>Get the milk</li></ol>
  <h2><span class="mw-headline">References</span></h2>
  <p>ignored</p>
</div>`

describe('parseGuideHtml', () => {
  const guide = parseGuideHtml(PAGE, "Cook's Assistant")

  it('extracts infobox facts in a stable order', () => {
    expect(guide.facts.map(f => f.key)).toEqual(['start', 'difficulty', 'requirements', 'items', 'rewards'])
    expect(guide.facts.find(f => f.key === 'items')!.html).toContain('Bucket of milk')
    expect(guide.facts.find(f => f.key === 'rewards')!.html).toContain('300 Cooking experience')
  })

  it('keeps guide sections and drops furniture sections', () => {
    expect(guide.sections.map(s => s.title)).toEqual(['', 'Walkthrough'])
    expect(guide.sections[1].html).toContain('Get the milk')
  })

  it('sanitizes scripts, absolutizes links and images', () => {
    const html = guide.sections.map(s => s.html).join('') + guide.facts.map(f => f.html).join('')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('srcset')
    expect(html).toContain('src="https://runescape.wiki/images/thumb/Egg.png/20px-Egg.png"')
    expect(html).toContain('href="https://runescape.wiki/w/Cook_(Lumbridge)"')
  })

  it('links to the wiki page', () => {
    expect(guide.url).toBe("https://runescape.wiki/w/Cook's_Assistant")
  })

  it('falls back to headed sections when there is no infobox', () => {
    const g = parseGuideHtml(
      '<div class="mw-parser-output"><h2>Items required</h2><ul><li>Rope</li></ul><h2>Walkthrough</h2><p>Go.</p></div>',
      'X',
    )
    expect(g.facts.map(f => f.key)).toEqual(['items'])
    expect(g.sections.map(s => s.title)).toEqual(['Walkthrough'])
  })

  it('keeps the whole page when nothing is recognised', () => {
    const g = parseGuideHtml('<div class="mw-parser-output"><p>Just text</p></div>', 'X')
    expect(g.facts).toEqual([])
    expect(g.sections[0].html).toContain('Just text')
  })
})

describe('factKeyFor', () => {
  it('maps common labels', () => {
    expect(factKeyFor('Items required')).toBe('items')
    expect(factKeyFor('Official difficulty')).toBe('difficulty')
    expect(factKeyFor('Enemies to defeat')).toBe('enemies')
    expect(factKeyFor('Ironman notes')).toBeNull()
  })
})
