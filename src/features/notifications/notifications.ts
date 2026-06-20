import { supabase } from '../../supabase'
import { fetchQuote } from '../finance/stocks'

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
