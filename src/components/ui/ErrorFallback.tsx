'use client'
interface ErrorFallbackProps {
  error: Error & { digest?: string }
  reset: () => void
}
export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6] mb-1">Algo salió mal</h2>
        <p className="text-sm text-gray-500 dark:text-[#787774] max-w-sm">
          {error.message || 'Ocurrió un error inesperado. Por favor intenta de nuevo.'}
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-gray-900 dark:bg-[#E8E8E6] text-white dark:text-[#191919] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
      >
        Intentar de nuevo
      </button>
    </div>
  )
}
