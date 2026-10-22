import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ExternalLink, Keyboard } from 'lucide-react'
import AbilityBars from '../features/runescape/AbilityBars'
import { WIKI_BARS_SNAPSHOT, WIKI_BARS_URL } from '../features/runescape/ability-bars-data'

export default function PvmBars() {
  const navigate = useNavigate()

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/runescape/pvm'))}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-sky-300/90">
            <Keyboard className="h-3.5 w-3.5" /> PvM
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Ability bars</h1>
          <p className="mt-1 text-sm text-white/70">Best-in-slot Revolution bars for every combat style, in action bar order</p>
          <a
            href={WIKI_BARS_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-sky-200 hover:text-white"
          >
            From the RS Wiki Revolution bars, {WIKI_BARS_SNAPSHOT} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </section>

      <AbilityBars />
    </div>
  )
}
