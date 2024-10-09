import { ErrorHandler } from './handler'

export function rescue<T, F>(
  fn: () => T | Promise<T>,
  fallback: F,
  onError?: (error: Error) => void,
): T | F | Promise<T | F> {
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.catch((error) => {
        if (onError) {
          onError(ErrorHandler.handle(error))
        }
        return fallback
      })
    }
    return result
  }
  catch (error) {
    if (onError) {
      onError(ErrorHandler.handle(error))
    }
    return fallback
  }
}
