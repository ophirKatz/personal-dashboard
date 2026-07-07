import type { PostgrestError } from '@supabase/supabase-js'

export class SupabaseQueryError extends Error {
  constructor(context: string, public readonly cause: PostgrestError) {
    super(`${context}: ${cause.message}`)
    this.name = 'SupabaseQueryError'
  }
}

// Use for list queries (.select('*') etc). Throws instead of silently
// swallowing a query error into an indistinguishable-from-empty [] result.
export async function mustList<T>(
  query: PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  context: string,
): Promise<T[]> {
  const { data, error } = await query
  if (error) {
    console.error(`[supabase] ${context} failed:`, error)
    throw new SupabaseQueryError(context, error)
  }
  return data ?? []
}

// Use for single-row queries (.single()/.maybeSingle()). Kept separate from
// mustList: a legitimate null from .maybeSingle() must stay null, not get
// coerced into [] by a shared generic.
export async function mustOne<T>(
  query: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  context: string,
): Promise<T | null> {
  const { data, error } = await query
  if (error) {
    console.error(`[supabase] ${context} failed:`, error)
    throw new SupabaseQueryError(context, error)
  }
  return data
}
