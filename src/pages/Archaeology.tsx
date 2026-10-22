import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ExternalLink, Shovel } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useActiveCharacter } from '../features/runescape/useActiveCharacter'
import ArchaeologyBoard from '../features/runescape/ArchaeologyBoard'

const WIKI_URL = 'https://runescape.wiki/w/Archaeology_training#Methods'

export default function Archaeology() {
  const navigate = useNavigate()
  const { load, retry } = useActiveCharacter()

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/runescape'))}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-amber-900 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-amber-300/90">
            <Shovel className="h-3.5 w-3.5" /> Archaeology
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Collections &amp; mysteries</h1>
          <p className="mt-1 text-sm text-white/70">
            {load.state === 'ready' ? `${load.characterName} · ` : ''}Artefacts found versus required, mysteries and collections
          </p>
          <a
            href={WIKI_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-amber-200 hover:text-white"
          >
            Requirements from the RuneScape Wiki <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </section>

      {load.state === 'loading' && <div className="h-24 animate-pulse rounded-2xl bg-muted" />}

      {load.state === 'ready' && <ArchaeologyBoard key={load.characterId} userId={load.userId} characterId={load.characterId} />}

      {load.state === 'unavailable' && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
          <p className="font-medium">No character yet</p>
          <p className="text-sm text-muted-foreground">Progress is tracked per character. Set one up on the RuneScape page first.</p>
          <Button asChild className="mt-2 rounded-xl"><Link to="/runescape">Go to RuneScape</Link></Button>
        </div>
      )}

      {load.state === 'error' && (
        <div className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-2">
            <p>Could not load your character.</p>
            <Button size="sm" variant="outline" onClick={retry}>Try again</Button>
          </div>
        </div>
      )}
    </div>
  )
}
