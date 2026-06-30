import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../supabase'
import type { Friend, FriendInteraction } from '../supabase'
import type { User } from '@supabase/supabase-js'
import FriendCard from '../features/friends/FriendCard'
import FriendForm from '../features/friends/FriendForm'
import { Button } from '../components/ui/button'
import { isFriendOverdue, friendDaysSinceLastInteraction } from '../utils'

export default function Friends() {
  const [user, setUser] = useState<User | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [interactions, setInteractions] = useState<FriendInteraction[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingFriend, setEditingFriend] = useState<Friend | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const [friendsRes, interactionsRes] = await Promise.all([
      supabase.from('friends').select('*').order('created_at'),
      supabase.from('friend_interactions').select('*'),
    ])
    setFriends(friendsRes.data ?? [])
    setInteractions(interactionsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteFriend(id: string) {
    if (!confirm('Delete this friend and all interaction history?')) return
    await supabase.from('friends').delete().eq('id', id)
    load()
  }

  const sortedFriends = [...friends].sort((a, b) => {
    const aOverdue = isFriendOverdue(a, interactions)
    const bOverdue = isFriendOverdue(b, interactions)
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    return friendDaysSinceLastInteraction(b, interactions) - friendDaysSinceLastInteraction(a, interactions)
  })

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Friends</h1>
          <p className="text-sm text-muted-foreground">{friends.length} friend{friends.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <Button onClick={() => { setEditingFriend(undefined); setShowForm(true) }} size="icon" className="rounded-xl h-11 w-11">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : friends.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">👥</div>
          <p className="font-medium">No friends yet</p>
          <p className="text-sm mt-1">Tap + to add someone you want to stay in touch with</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFriends.map(friend => (
            <FriendCard
              key={friend.id}
              friend={friend}
              interactions={interactions}
              userId={user?.id ?? ''}
              onEdit={() => { setEditingFriend(friend); setShowForm(true) }}
              onDelete={() => deleteFriend(friend.id)}
              onLogChange={load}
            />
          ))}
        </div>
      )}

      {user && showForm && (
        <FriendForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={load}
          friend={editingFriend}
          userId={user.id}
        />
      )}
    </div>
  )
}
