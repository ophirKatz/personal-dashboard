import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../supabase'
import { Button } from './ui/button'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      return supabase.from('client_errors').insert({
        user_id: user.id,
        message: error.message,
        stack: error.stack ?? null,
        url: window.location.pathname,
      })
    }).catch(err => console.error('Failed to record client error:', err))
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold">Something went wrong</p>
          <p className="text-sm text-muted-foreground mt-1">
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    )
  }
}
