import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ClipboardPaste, Link2, PencilLine } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import ImportRecipeDialog from './ImportRecipeDialog'

type Mode = 'prompt' | 'paste' | 'link'

type Props = {
  open: boolean
  onClose: () => void
}

const OPTIONS: Array<{ mode: Mode | 'manual'; icon: typeof Sparkles; title: string; description: string }> = [
  { mode: 'prompt', icon: Sparkles, title: 'Prompt to recipe', description: 'Turn a quick description into a detailed recipe.' },
  { mode: 'paste', icon: ClipboardPaste, title: 'Paste recipe text', description: 'Drop in recipe text and we will parse it for you.' },
  { mode: 'link', icon: Link2, title: 'Paste a link', description: 'We will fetch the details from the webpage.' },
  { mode: 'manual', icon: PencilLine, title: 'Start from scratch', description: 'Open the manual form and add everything yourself.' },
]

export default function AddRecipeSheet({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [importMode, setImportMode] = useState<Mode | null>(null)

  function handleSelect(mode: Mode | 'manual') {
    if (mode === 'manual') {
      onClose()
      navigate('/recipes/new')
      return
    }
    setImportMode(mode)
  }

  return (
    <>
      <Drawer open={open && !importMode} onOpenChange={v => !v && onClose()}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>How would you like to start?</DrawerTitle></DrawerHeader>
          <DrawerBody className="space-y-2">
            {OPTIONS.map(option => (
              <button
                key={option.title}
                onClick={() => handleSelect(option.mode)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-accent text-left transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <option.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{option.title}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </button>
            ))}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {importMode && (
        <ImportRecipeDialog
          open={!!importMode}
          mode={importMode}
          onClose={() => { setImportMode(null); onClose() }}
        />
      )}
    </>
  )
}
