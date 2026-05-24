import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  title?: string
  message?: string
  errorId?: string
  onRetry?: () => void
}

/** Full-page or section-level error state — never white-screens */
export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  errorId,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-10 text-center"
    >
      <AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{message}</p>
        {errorId && (
          <p className="mt-2 font-mono text-xs text-slate-400">
            Support ID: {errorId}
          </p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  )
}

interface EmptyStateProps {
  title?: string
  message?: string
  icon?: React.ReactNode
}

/** Empty state for tables / lists with no data */
export function EmptyState({
  title = 'No data',
  message = 'Nothing to show here yet.',
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50 py-16 text-center"
      aria-label={title}
    >
      <p className="font-medium text-slate-700">{title}</p>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}
