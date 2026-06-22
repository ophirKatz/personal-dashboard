// Personal API tokens used by external callers (e.g. an iOS Shortcut) that can't hold a
// short-lived Supabase session JWT. Only the SHA-256 hash is ever stored — the raw token
// is shown once at creation time and is unrecoverable after that.
export function generateRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashToken(rawToken: string): Promise<string> {
  const data = new TextEncoder().encode(rawToken)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
