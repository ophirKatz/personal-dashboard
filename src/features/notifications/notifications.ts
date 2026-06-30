import { supabase } from '../../supabase'
import { fetchQuote } from '../finance/stocks'
import { isFriendOverdue, formatFriendGoal } from '../../utils'
import type { FriendInteraction } from '../../supabase'

export async function checkStockAlerts(userId: string) {
  const { data: alerts } = await supabase.from('stock_alerts').select('*').eq('user_id', userId)
  if (!alerts) return

  for (const alert of alerts) {
    try {
      const quote = await fetchQuote(alert.symbol)
      if (quote.current >= alert.target_price && !alert.triggered_at) {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'stock_alert',
          title: `${alert.symbol} hit your target`,
          message: `${alert.symbol} is now $${quote.current.toFixed(2)}, above your alert level of $${alert.target_price.toFixed(2)}.`,
        })
        await supabase.from('stock_alerts').update({ triggered_at: new Date().toISOString() }).eq('id', alert.id)
      } else if (quote.current < alert.target_price && alert.triggered_at) {
        await supabase.from('stock_alerts').update({ triggered_at: null }).eq('id', alert.id)
      }
    } catch {
      // skip symbols that fail to fetch (e.g. missing API key)
    }
  }
}

export async function checkFriendReminders(userId: string) {
  const { data: friends } = await supabase
    .from('friends')
    .select('*')
    .eq('user_id', userId)
    .eq('reminder_enabled', true)
  if (!friends) return

  const { data: interactions } = await supabase
    .from('friend_interactions')
    .select('*')
    .eq('user_id', userId)
  const allInteractions: FriendInteraction[] = interactions ?? []

  for (const friend of friends) {
    const overdue = isFriendOverdue(friend, allInteractions)
    if (overdue && !friend.reminder_notified_at) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'friend_reminder',
        title: `Stay in touch with ${friend.name}`,
        message: `You haven't connected in a while — your goal is ${formatFriendGoal(friend.goal_count, friend.goal_unit)}.`,
      })
      await supabase.from('friends').update({ reminder_notified_at: new Date().toISOString() }).eq('id', friend.id)
    } else if (!overdue && friend.reminder_notified_at) {
      await supabase.from('friends').update({ reminder_notified_at: null }).eq('id', friend.id)
    }
  }
}
