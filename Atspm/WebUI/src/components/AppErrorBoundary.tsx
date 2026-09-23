import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { AppErrorFallback } from './AppErrorFallback'

export function AppErrorBoundary({
  children,
  resetKey,
}: {
  children: ReactNode
  resetKey: string
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          FallbackComponent={AppErrorFallback}
          onReset={reset}
          resetKeys={[resetKey]}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
