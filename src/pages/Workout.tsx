import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import WorkoutForm from '../features/workout/WorkoutForm'
import WorkoutHistory from '../features/workout/WorkoutHistory'
import WorkoutSettings from '../features/workout/WorkoutSettings'

export default function Workout() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Home workout</h1>
        <p className="text-sm text-muted-foreground">Log workouts, manage presets</p>
      </div>

      <Tabs defaultValue="log">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="log" className="flex-1">Log</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <WorkoutForm key={refreshKey} onSaved={() => setRefreshKey(k => k + 1)} />
        </TabsContent>
        <TabsContent value="history">
          <WorkoutHistory key={refreshKey} />
        </TabsContent>
        <TabsContent value="settings">
          <WorkoutSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
