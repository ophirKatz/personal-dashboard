import { supabase } from '../../supabase'

// Fire-and-forget: the edge function checks for linked friends itself and
// no-ops if there are none, so callers don't need to pre-check.
export function logFriendInteractionsForCompletedTask(todoId: string) {
  supabase.functions
    .invoke('create-task-friend-interactions', { body: { todo_id: todoId } })
    .catch(err => console.error('Failed to log friend interactions for completed task', err))
}
