import { supabase } from '../../supabase'

// Same definition as the "To buy" tab on the Shopping page: items not checked off.
// Throws if the query fails.
export async function fetchItemsToBuyCount(): Promise<number> {
  const { count, error } = await supabase
    .from('shopping_items')
    .select('id', { count: 'exact', head: true })
    .eq('checked', false)
  if (error) throw error
  return count ?? 0
}

export function itemsToBuyLabel(count: number): string {
  if (count === 0) return 'Nothing to buy'
  return count === 1 ? '1 item to buy' : `${count} items to buy`
}
