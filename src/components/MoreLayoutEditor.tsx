import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select'
import { haptic } from '../lib/haptics'
import { getMoreSections, setMoreSections } from '../lib/userSettings'
import {
  ALL_NAV_KEYS,
  NAV_ITEMS,
  MORE_SECTIONS_CHANGED_EVENT,
  resolveMoreSections,
  type MoreSection,
  type NavItemKey,
} from '../lib/navItems'

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

export default function MoreLayoutEditor({ bottomNavItems }: { bottomNavItems: NavItemKey[] }) {
  const [stored, setStored] = useState<MoreSection[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMoreSections().then(s => {
      setStored(s)
      setLoading(false)
    })
  }, [])

  const moreKeys = ALL_NAV_KEYS.filter(k => !bottomNavItems.includes(k))
  const sections = resolveMoreSections(stored, moreKeys)

  async function save(next: MoreSection[] | null) {
    haptic('selection')
    setStored(next)
    window.dispatchEvent(new CustomEvent(MORE_SECTIONS_CHANGED_EVENT, { detail: next }))
    await setMoreSections(next)
  }

  const updateSection = (index: number, patch: Partial<MoreSection>) =>
    save(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  function moveItemToSection(key: NavItemKey, from: number, to: number) {
    if (from === to) return
    save(sections.map((s, i) => {
      if (i === from) return { ...s, items: s.items.filter(k => k !== key) }
      if (i === to) return { ...s, items: [...s.items, key] }
      return s
    }))
  }

  function addSection() {
    save([...sections, { id: crypto.randomUUID(), title: 'New section', items: [] }])
  }

  // Items of a deleted section fall into the (new) last section via resolveMoreSections.
  function deleteSection(index: number) {
    save(sections.filter((_, i) => i !== index))
  }

  if (loading) return null

  return (
    <div className="space-y-3">
      {sections.map((section, si) => (
        <div key={section.id} className="border border-border rounded-xl p-3">
          <div className="flex items-center gap-1 mb-2">
            <Input
              defaultValue={section.title}
              onBlur={e => {
                const title = e.target.value.trim() || section.title
                if (title !== section.title) updateSection(si, { title })
                else e.target.value = section.title
              }}
              className="h-9 font-medium"
            />
            <button
              onClick={() => save(move(sections, si, si - 1))}
              disabled={si === 0}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30"
              title="Move section up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => save(move(sections, si, si + 1))}
              disabled={si === sections.length - 1}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30"
              title="Move section down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={() => deleteSection(si)}
              disabled={sections.length === 1}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive disabled:opacity-30"
              title="Delete section (its pages move to the last section)"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1 py-2">Empty — hidden on the More page.</p>
          ) : (
            <div className="space-y-1">
              {section.items.map((key, ii) => {
                const { icon: Icon, label } = NAV_ITEMS[key]
                return (
                  <div key={key} className="flex items-center gap-1">
                    <Icon className="h-4 w-4 text-muted-foreground mx-2 shrink-0" />
                    <span className="flex-1 text-sm truncate">{label}</span>
                    <button
                      onClick={() => updateSection(si, { items: move(section.items, ii, ii - 1) })}
                      disabled={ii === 0}
                      className="p-1 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => updateSection(si, { items: move(section.items, ii, ii + 1) })}
                      disabled={ii === section.items.length - 1}
                      className="p-1 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <Select value={String(si)} onValueChange={v => moveItemToSection(key, si, Number(v))}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((s, i) => (
                          <SelectItem key={s.id} value={String(i)}>{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={addSection}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add section
        </Button>
        {stored && (
          <Button variant="ghost" onClick={() => save(null)}>
            Reset to default
          </Button>
        )}
      </div>
    </div>
  )
}
