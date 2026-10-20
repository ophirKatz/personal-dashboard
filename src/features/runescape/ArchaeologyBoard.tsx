import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, CircleHelp, Library, Shovel } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import ArchaeologyTracker from './ArchaeologyTracker'
import CollectionList from './CollectionList'
import MysteryList from './MysteryList'
import { useArchaeologyProgress } from './useArchaeologyProgress'

type Props = {
  userId: string
  characterId: string
}

const TABS = ['artefacts', 'mysteries', 'collections']

export default function ArchaeologyBoard({ userId, characterId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab') ?? ''
  const tab = TABS.includes(requested) ? requested : 'artefacts'
  const progress = useArchaeologyProgress(userId, characterId)

  // Artefacts and mysteries show saved progress; collections are reference only.
  function needsProgress(content: ReactNode) {
    if (progress.loading) return <div className="h-24 animate-pulse rounded-2xl bg-muted" />
    if (progress.loadFailed) {
      return (
        <div className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-2">
            <p>Could not load your Archaeology progress.</p>
            <Button size="sm" variant="outline" onClick={progress.reload}>Try again</Button>
          </div>
        </div>
      )
    }
    return content
  }

  return (
    <div className="space-y-3">
      {progress.message && (
        <button onClick={progress.dismissMessage} className="flex w-full items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-left text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> <span>{progress.message}</span>
        </button>
      )}

      <Tabs value={tab} onValueChange={t => setSearchParams(t === 'artefacts' ? {} : { tab: t }, { replace: true })}>
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="artefacts" className="gap-1.5 py-2"><Shovel className="h-4 w-4" />Artefacts</TabsTrigger>
          <TabsTrigger value="mysteries" className="gap-1.5 py-2"><CircleHelp className="h-4 w-4" />Mysteries</TabsTrigger>
          <TabsTrigger value="collections" className="gap-1.5 py-2"><Library className="h-4 w-4" />Collections</TabsTrigger>
        </TabsList>

        {/* Kept mounted (just hidden) so each tab keeps its open sections and filters when you switch. */}
        <TabsContent value="artefacts" forceMount className="mt-4 data-[state=inactive]:hidden">
          {needsProgress(<ArchaeologyTracker found={progress.found} onChange={progress.setCount} />)}
        </TabsContent>
        <TabsContent value="mysteries" forceMount className="mt-4 data-[state=inactive]:hidden">
          {needsProgress(<MysteryList found={progress.found} onChange={progress.setCount} />)}
        </TabsContent>
        <TabsContent value="collections" forceMount className="mt-4 data-[state=inactive]:hidden">
          <CollectionList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
