import { useEffect, useRef, useState } from 'react'
import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { haptic } from '../../lib/haptics'
import {
  ALLOWED_GAME_IMAGE_TYPES,
  MAX_GAME_IMAGE_BYTES,
  deleteOwnedGameImage,
  saveGameUtilityOverride,
  uploadGameImage,
  type GameUtility,
} from './utilities'

type ImageChoice =
  | { kind: 'default' }
  | { kind: 'custom'; url: string }
  | { kind: 'file'; file: File; preview: string }
  | { kind: 'none' }

function initialImageChoice(utility: GameUtility): ImageChoice {
  if (!utility.image) return { kind: 'none' }
  if (utility.customImageUrl) return { kind: 'custom', url: utility.customImageUrl }
  return { kind: 'default' }
}

type Props = {
  utility: GameUtility | null
  userId: string | null
  onClose: () => void
  onSaved: () => void
}

export default function EditGameUtilityDrawer({ utility, userId, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<ImageChoice>({ kind: 'none' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!utility) return
    setName(utility.name)
    setDescription(utility.description)
    setImage(initialImageChoice(utility))
    setError(null)
    setSaving(false)
  }, [utility])

  const previewSrc =
    image.kind === 'file' ? image.preview
    : image.kind === 'custom' ? image.url
    : image.kind === 'default' ? utility?.defaultImage ?? null
    : null

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_GAME_IMAGE_TYPES.has(file.type)) {
      setError('Please choose a JPEG, PNG, WebP, GIF, or SVG image.')
      return
    }
    if (file.size > MAX_GAME_IMAGE_BYTES) {
      setError('Image must be under 8 MB.')
      return
    }
    setError(null)
    setImage({ kind: 'file', file, preview: URL.createObjectURL(file) })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!utility || !userId || !name.trim()) return
    setSaving(true)
    setError(null)

    let imageUrl: string | null = null
    try {
      if (image.kind === 'file') imageUrl = await uploadGameImage(userId, utility.key, image.file)
      else if (image.kind === 'custom') imageUrl = image.url

      await saveGameUtilityOverride(userId, utility.key, {
        name: name.trim(),
        description: description.trim(),
        image_url: imageUrl,
        show_image: image.kind !== 'none',
      })
    } catch (err) {
      console.error('Could not save utility', err)
      setError('Could not save changes.')
      setSaving(false)
      return
    }

    if (utility.customImageUrl && utility.customImageUrl !== imageUrl) {
      deleteOwnedGameImage(utility.customImageUrl)
    }

    haptic('success')
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Drawer open={utility !== null} onOpenChange={open => { if (!open) onClose() }}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>Edit utility</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex gap-3">
                <div className="w-28 aspect-[4/3] shrink-0 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  {previewSrc ? <img src={previewSrc} alt="" className="w-full h-full object-cover" /> : 'No image'}
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus className="h-3.5 w-3.5" /> Upload image
                  </Button>
                  {utility?.defaultImage && image.kind !== 'default' && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setImage({ kind: 'default' })}>
                      <RotateCcw className="h-3.5 w-3.5" /> Use default
                    </Button>
                  )}
                  {image.kind !== 'none' && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setImage({ kind: 'none' })}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove image
                    </Button>
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="game-utility-name">Name</Label>
              <Input id="game-utility-name" value={name} onChange={e => setName(e.target.value)} maxLength={60} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="game-utility-description">Description</Label>
              <Textarea
                id="game-utility-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={200}
                rows={3}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
