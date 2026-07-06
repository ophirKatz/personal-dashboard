import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import type { RecipeDraft } from './recipes'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/textarea'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog'

type Mode = 'prompt' | 'paste' | 'link'

type Props = {
  open: boolean
  mode: Mode
  onClose: () => void
}

const COPY: Record<Mode, { title: string; placeholder: string; label: string; multiline: boolean }> = {
  prompt: { title: 'Prompt to recipe', placeholder: 'e.g. garlic butter shrimp pasta with lemon', label: 'Describe the dish', multiline: false },
  paste: { title: 'Paste recipe text', placeholder: 'Paste the full recipe text here…', label: 'Recipe text', multiline: true },
  link: { title: 'Paste a link', placeholder: 'https://example.com/recipe', label: 'Recipe URL', multiline: false },
}

export default function ImportRecipeDialog({ open, mode, onClose }: Props) {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[mode]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('import-recipe', {
        body: { mode, input: input.trim() },
      })
      if (fnError) {
        const body = await fnError.context?.json?.().catch(() => null)
        throw new Error(body?.message ?? body?.error ?? fnError.message ?? 'Import failed')
      }
      const draft: RecipeDraft = data.draft
      navigate('/recipes/new', { state: { draft, sourceUrl: data.source_url ?? null, importMethod: mode } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{copy.title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-3">
            {copy.multiline ? (
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={copy.placeholder}
                rows={8}
                autoFocus
                disabled={loading}
              />
            ) : (
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={copy.placeholder}
                autoFocus
                disabled={loading}
                type={mode === 'link' ? 'url' : 'text'}
              />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading || !input.trim()}>
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
