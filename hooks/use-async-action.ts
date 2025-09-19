import { useState, useCallback } from 'react'
import { handleApiError, type ErrorHandlingOptions } from '@/lib/error-handling'

interface UseAsyncActionOptions extends ErrorHandlingOptions {
  onSuccess?: () => void
}

export function useAsyncAction<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  options: UseAsyncActionOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(
    async (...args: T): Promise<R | null> => {
      try {
        setIsLoading(true)
        setError(null)
        
        const result = await asyncFn(...args)
        
        if (options.onSuccess) {
          options.onSuccess()
        }
        
        return result
      } catch (err) {
        const appError = handleApiError(err, options)
        setError(appError)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [asyncFn, options]
  )

  const reset = useCallback(() => {
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    execute,
    isLoading,
    error,
    reset
  }
}