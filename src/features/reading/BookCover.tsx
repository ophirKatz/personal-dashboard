import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { cn } from '../../utils'

type Props = { url: string | null; title: string; className?: string }

export default function BookCover({ url, title, className }: Props) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cn('bg-muted flex items-center justify-center overflow-hidden', className)}>
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-1.5 p-2 text-muted-foreground">
          <BookOpen className="h-6 w-6" />
          <span className="text-[10px] leading-tight text-center line-clamp-3">{title}</span>
        </div>
      )}
    </div>
  )
}
