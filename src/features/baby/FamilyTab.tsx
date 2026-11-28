import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Share2, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { haptic } from '../../lib/haptics'
import {
  createInvite,
  errorMessage,
  loadInvites,
  removeMember,
  renameMember,
  revokeInvite,
  updateBaby,
} from './babyApi'
import type { Baby, BabyInvite, BabyMember, BabyRole } from './babyEvents'
import { inviteExpiryLabel, inviteUrl, parseEmail } from './babyInvites'

type Props = {
  baby: Baby
  userId: string
  role: BabyRole
  members: BabyMember[]
  now: number
  onMembersChanged: () => void
  onBabyChanged: (baby: Baby) => void
  /** The signed-in person left the tracker. */
  onLeft: () => void
}

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default function FamilyTab({ baby, userId, role, members, now, onMembersChanged, onBabyChanged, onLeft }: Props) {
  const isParent = role === 'parent'
  const active = members.filter(m => !m.removed_at)
  const me = active.find(m => m.user_id === userId)

  const [error, setError] = useState<string | null>(null)

  // Baby details
  const [name, setName] = useState(baby.name)
  const [birthDate, setBirthDate] = useState(baby.birth_date ?? '')
  const [savingBaby, setSavingBaby] = useState(false)
  const babyChanged = name.trim() !== baby.name || (birthDate || null) !== baby.birth_date

  // My name (the member list may still be loading when this opens)
  const [myName, setMyName] = useState(me?.display_name ?? '')
  const savedName = me?.display_name
  useEffect(() => {
    if (savedName) setMyName(savedName)
  }, [savedName])

  // Invites
  const [invites, setInvites] = useState<BabyInvite[]>([])
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const reloadInvites = useCallback(async () => {
    if (!isParent) return
    try {
      setInvites(await loadInvites(baby.id))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [baby.id, isParent])

  useEffect(() => {
    reloadInvites()
  }, [reloadInvites])

  async function saveBaby() {
    if (!name.trim() || savingBaby) return
    setSavingBaby(true)
    setError(null)
    try {
      onBabyChanged(await updateBaby(baby.id, { name: name.trim(), birth_date: birthDate || null }))
      haptic('success')
    } catch (e) {
      setError(errorMessage(e))
    }
    setSavingBaby(false)
  }

  async function saveMyName() {
    const next = myName.trim()
    if (!next || next === me?.display_name) return
    setError(null)
    try {
      await renameMember(baby.id, userId, next)
      onMembersChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function handleRemove(member: BabyMember) {
    const self = member.user_id === userId
    const question = self
      ? 'Leave this tracker? You will lose access to it until someone invites you again.'
      : `Remove ${member.display_name}? They will lose access to this tracker.`
    if (!confirm(question)) return
    haptic('warning')
    setError(null)
    try {
      await removeMember(baby.id, member.user_id)
      if (self) onLeft()
      else onMembersChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function handleCreateInvite() {
    const parsed = parseEmail(email)
    if (!parsed.ok) {
      setError('That email address does not look right.')
      return
    }
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      await createInvite(baby.id, parsed.email)
      setEmail('')
      haptic('success')
      await reloadInvites()
    } catch (e) {
      setError(errorMessage(e))
    }
    setCreating(false)
  }

  async function handleRevoke(invite: BabyInvite) {
    haptic('light')
    try {
      await revokeInvite(invite.id)
      setInvites(prev => prev.filter(i => i.id !== invite.id))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function handleCopy(invite: BabyInvite) {
    try {
      await navigator.clipboard.writeText(inviteUrl(window.location.origin, invite.token))
      setCopiedId(invite.id)
      setTimeout(() => setCopiedId(id => (id === invite.id ? null : id)), 1500)
    } catch {
      setError('Could not copy the link. Select and copy it by hand instead.')
    }
  }

  async function handleShare(invite: BabyInvite) {
    try {
      await navigator.share({ title: `Join ${baby.name}'s tracker`, url: inviteUrl(window.location.origin, invite.token) })
    } catch {
      // Closing the share sheet rejects with AbortError; nothing to report.
    }
  }

  return (
    <div className="space-y-6">
      <Section title="People">
        <div className="space-y-2">
          {active.map(m => (
            <div key={m.user_id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.display_name}
                  {m.user_id === userId && <span className="font-normal text-muted-foreground"> (you)</span>}
                </p>
              </div>
              <Badge variant="secondary">{m.role === 'parent' ? 'Parent' : 'View only'}</Badge>
              {(m.user_id === userId || isParent) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => handleRemove(m)}
                >
                  {m.user_id === userId ? 'Leave' : 'Remove'}
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            aria-label="Your name"
            value={myName}
            maxLength={40}
            onChange={e => setMyName(e.target.value)}
            onBlur={saveMyName}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
        <p className="px-1 text-xs text-muted-foreground">Your name, as shown next to the entries you log.</p>
      </Section>

      {isParent && (
        <Section title="Invite someone">
          <p className="px-1 text-xs text-muted-foreground">
            The link works for one person and stops working after 7 days. Add their Google email so only that account can use it.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              aria-label="Their email (optional)"
              placeholder="Their email (recommended)"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateInvite()}
            />
            <Button onClick={handleCreateInvite} disabled={creating} className="shrink-0 rounded-lg">
              {creating ? 'Creating…' : 'Create link'}
            </Button>
          </div>

          {invites.map(invite => (
            <div key={invite.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{invite.invited_email ?? 'Anyone with the link'}</p>
                <p className="text-xs text-muted-foreground">{inviteExpiryLabel(invite.expires_at, now)}</p>
              </div>
              <Button variant="outline" size="icon" aria-label="Copy invite link" onClick={() => handleCopy(invite)}>
                {copiedId === invite.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              {canNativeShare && (
                <Button variant="outline" size="icon" aria-label="Share invite link" onClick={() => handleShare(invite)}>
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" aria-label="Revoke invite" onClick={() => handleRevoke(invite)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </Section>
      )}

      {isParent && (
        <Section title="Baby">
          <Input aria-label="Baby's name" value={name} maxLength={60} onChange={e => setName(e.target.value)} />
          <div className="space-y-1">
            <Input type="date" aria-label="Birth date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
            <p className="px-1 text-xs text-muted-foreground">Leave the date empty until the baby is born.</p>
          </div>
          {babyChanged && (
            <Button onClick={saveBaby} disabled={savingBaby || !name.trim()} className="w-full rounded-xl">
              {savingBaby ? 'Saving…' : 'Save'}
            </Button>
          )}
        </Section>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <p className="px-1 text-xs text-muted-foreground">
        Only the people listed above can see this log. There is no public link to it, and the invite links only add a person
        once.
      </p>
    </div>
  )
}
