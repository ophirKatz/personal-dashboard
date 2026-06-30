import { useState } from 'react'
import { Pencil, Trash2, MessageCircle } from 'lucide-react'
import type { Friend, FriendInteraction } from '../../supabase'
import { formatFriendGoal, friendDaysSinceLastInteraction, isFriendOverdue } from '../../utils'
import { haptic } from '../../lib/haptics'
import { initials } from './friends'
import LogInteractionDrawer from './LogInteractionDrawer'

type Props = {
  friend: Friend
  interactions: FriendInteraction[]
  userId: string
  onEdit: () => void
  onDelete: () => void
  onLogChange: () => void
}

export default function FriendCard({ friend, interactions, userId, onEdit, onDelete, onLogChange }: Props) {
  const [showLog, setShowLog] = useState(false)
  const daysSince = friendDaysSinceLastInteraction(friend, interactions)
  const overdue = isFriendOverdue(friend, interactions)

  function handleDelete() {
    haptic('warning')
    onDelete()
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
        {friend.avatar_url ? (
          <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          initials(friend.name)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{friend.name}</div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-0.5 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">{formatFriendGoal(friend.goal_count, friend.goal_unit)}</span>
          <span className="text-border">·</span>
          <span className="whitespace-nowrap">{daysSince === 0 ? 'Today' : `${daysSince}d ago`}</span>
          {overdue && (
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              Overdue
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => setShowLog(true)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Log interaction">
          <MessageCircle className="h-4 w-4" />
        </button>
        <button onClick={onEdit} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <LogInteractionDrawer
        open={showLog}
        onClose={() => setShowLog(false)}
        onSave={onLogChange}
        friendId={friend.id}
        userId={userId}
      />
    </div>
  )
}
