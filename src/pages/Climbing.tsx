import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import SessionForm from '../features/climbing/SessionForm'
import SessionHistory from '../features/climbing/SessionHistory'
import ClimbingStats from '../features/climbing/ClimbingStats'

export default function Climbing() {
  const [user, setUser] = useState<User | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Climbing</h1>
        <p className="text-sm text-muted-foreground">Log sessions, track progress</p>
      </div>

      <Tabs defaultValue="log">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="log" className="flex-1">Log</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
          <TabsTrigger value="stats" className="flex-1">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          {user && (
            <SessionForm
              key={refreshKey}
              userId={user.id}
              onSaved={() => setRefreshKey(k => k + 1)}
            />
          )}
        </TabsContent>

        <TabsContent value="history">
          <SessionHistory key={refreshKey} />
        </TabsContent>

        <TabsContent value="stats">
          <ClimbingStats />
        </TabsContent>
      </Tabs>
    </div>
  )
}
