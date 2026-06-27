import type { FileRecord } from '../../supabase'
import { fileIcon } from '../../utils'

type Props = {
  files: FileRecord[]
  onSelect: (file: FileRecord) => void
  emptyMessage?: string
}

export default function StarredFilesGrid({ files, onSelect, emptyMessage }: Props) {
  const starred = files.filter(f => f.is_starred)

  if (starred.length === 0) {
    return emptyMessage ? (
      <div className="text-center py-10 text-muted-foreground">
        <div className="text-3xl mb-2">⭐</div>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    ) : null
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {starred.map(file => (
        <button
          key={file.id}
          onClick={() => onSelect(file)}
          className="flex flex-col items-center gap-1.5 p-3 bg-card border border-border rounded-xl hover:bg-accent transition-colors text-center"
        >
          <span className="text-2xl">{fileIcon(file.mime_type)}</span>
          <span className="text-xs font-medium truncate max-w-full">{file.name}</span>
        </button>
      ))}
    </div>
  )
}
