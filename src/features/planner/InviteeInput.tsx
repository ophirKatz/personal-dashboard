import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AtSign, Mail, X } from 'lucide-react'
import type { Invitee } from '../../supabase'
import { cn } from '../../utils'
import { initials } from '../friends/friends'
import { inviteeLabel, isValidEmail, suggestInvitees } from './planner'

type Props = {
  value: Invitee[]
  onChange: (value: Invitee[]) => void
  // Everyone that can be suggested; see buildInviteePool.
  pool: Invitee[]
  placeholder?: string
}

// People to invite, as chips. Typing "@" lists everyone you know; typing more narrows the list by
// name or email. A full email address that isn't in the list can still be added as it is.
export default function InviteeInput({ value, onChange, pool, placeholder = 'Type @ to add people' }: Props) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const query = text.replace(/^@/, '').trim().toLowerCase()
  const taken = useMemo(() => value.map(v => v.email.toLowerCase()), [value])
  const matches = useMemo(() => suggestInvitees(pool, query, taken), [pool, query, taken])
  const rawEmail = isValidEmail(query) && !taken.includes(query) && !matches.some(m => m.email.toLowerCase() === query) ? query : null
  const options: (Invitee & { raw?: boolean })[] = [...matches, ...(rawEmail ? [{ email: rawEmail, raw: true }] : [])]
  const open = focused && text.length > 0 && options.length > 0
  const current = Math.min(active, Math.max(options.length - 1, 0))

  // The list opens below the field, which is often at the bottom of the sheet (and above the
  // keyboard): bring it into view rather than leaving it off-screen.
  useEffect(() => {
    if (open) listRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open, options.length])

  function add(invitee: Invitee) {
    onChange([...value, { email: invitee.email.toLowerCase(), name: invitee.name ?? null }])
    setText('')
    setActive(0)
  }

  function remove(email: string) {
    onChange(value.filter(v => v.email !== email))
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setActive((current + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      if (text.length === 0) return
      e.preventDefault()
      if (open) add(options[current])
    } else if (e.key === ' ' && rawEmail) {
      e.preventDefault()
      add({ email: rawEmail })
    } else if (e.key === 'Escape' && text.length > 0) {
      e.preventDefault()
      e.stopPropagation() // the sheet around this closes on Escape; clear the text first
      setText('')
    } else if (e.key === 'Backspace' && text.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring"
      >
        <AtSign className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {value.map(invitee => (
          <span
            key={invitee.email}
            title={invitee.email}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary py-1 pl-2.5 pr-1 text-sm"
          >
            <span dir="auto" className="truncate">{inviteeLabel(invitee)}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); remove(invitee.email) }}
              aria-label={`Remove ${inviteeLabel(invitee)}`}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (rawEmail) add({ email: rawEmail }) // an address typed in full is kept, not lost
          }}
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={value.length === 0 ? placeholder : '@'}
          role="combobox"
          aria-label="Invite people"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${current}` : undefined}
          aria-autocomplete="list"
          className="min-w-[8ch] flex-1 bg-transparent py-1 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
        />
      </div>

      {open && (
        // In the flow of the page, not floating: inside a scrolling sheet with the keyboard up, a
        // popup would be clipped or cover the field.
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          // keep focus in the input when a suggestion is pressed, so the keyboard stays up
          onMouseDown={e => e.preventDefault()}
          className="mt-1.5 overflow-hidden rounded-xl border border-border bg-background shadow-sm"
        >
          {options.map((option, i) => (
            <li key={option.email} id={`${listId}-${i}`} role="option" aria-selected={i === current}>
              <button
                type="button"
                onClick={() => add(option)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left', i === current && 'bg-accent')}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {option.raw ? <Mail className="h-4 w-4" /> : initials(inviteeLabel(option))}
                </span>
                <span className="min-w-0">
                  {option.raw ? (
                    <span className="block truncate text-sm font-medium">Invite {option.email}</span>
                  ) : (
                    <>
                      <span dir="auto" className="block truncate text-sm font-medium">{inviteeLabel(option)}</span>
                      {option.name && <span className="block truncate text-xs text-muted-foreground">{option.email}</span>}
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
