import { useEffect, useState } from 'react'
import { Mic, Copy, Check, Trash2 } from 'lucide-react'
import { supabase } from '../../supabase'
import type { ApiToken } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog'
import { haptic } from '../../lib/haptics'
import { generateRawToken, hashToken } from '../../lib/apiTokens'
import { formatDate } from '../../utils'

type Props = {
  userId: string
}

export default function VoiceShortcutsSection({ userId }: Props) {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    const { data } = await supabase.from('api_tokens').select('*').order('created_at', { ascending: false })
    setTokens(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    setCreating(true)
    const raw = generateRawToken()
    const tokenHash = await hashToken(raw)
    const { error } = await supabase
      .from('api_tokens')
      .insert({ user_id: userId, label: 'Voice Shortcuts', token_hash: tokenHash })
    setCreating(false)
    if (error) return
    haptic('success')
    setNewToken(raw)
    load()
  }

  async function handleRevoke(id: string) {
    haptic('light')
    await supabase.from('api_tokens').delete().eq('id', id)
    load()
  }

  async function handleCopy() {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 mt-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-muted">
          <Mic className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">Voice shortcuts (Siri)</p>
          <p className="text-sm text-muted-foreground">
            Generate a token to use with an iOS Shortcut, e.g. "Hey Siri, add to shopping list" or
            "Hey Siri, log a climb".
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tokens.length > 0 && (
            <div className="space-y-1.5 mt-4">
              {tokens.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(t.created_at)}
                      {t.last_used_at ? ` · last used ${formatDate(t.last_used_at)}` : ' · never used'}
                    </p>
                  </div>
                  <button onClick={() => handleRevoke(t.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button onClick={handleCreate} disabled={creating} className="w-full mt-4" variant="outline">
            {creating ? 'Generating…' : 'Generate new token'}
          </Button>
        </>
      )}

      <Dialog open={!!newToken} onOpenChange={open => !open && setNewToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new token</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy this now — it won't be shown again. Paste it into your iOS Shortcut's request
              header as <code className="text-xs">Authorization: Bearer &lt;token&gt;</code>.
            </p>
            <div className="space-y-2">
              <Label>Token</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={newToken ?? ''}
                  className="font-mono text-xs"
                  onFocus={e => e.target.select()}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setNewToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
