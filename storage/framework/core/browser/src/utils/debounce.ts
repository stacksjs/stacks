export interface DebounceOptions {
  leading?: boolean
  trailing?: boolean
}

export type DebouncedFunction<T extends (..._args: any[]) => any> = {
  (this: ThisParameterType<T>, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined>
  cancel: () => void
  flush: () => Promise<Awaited<ReturnType<T>> | undefined>
}

export function debounce<T extends (..._args: any[]) => any>(
  fn: T,
  wait: number = 0,
  options: DebounceOptions = {},
): DebouncedFunction<T> {
  const { leading = false, trailing = true } = options

  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  let lastThis: ThisParameterType<T> | undefined
  let lastResult: Awaited<ReturnType<T>> | undefined
  let pending: Array<{
    resolve: (value: Awaited<ReturnType<T>> | undefined) => void
    reject: (reason: unknown) => void
  }> = []

  const settlePending = (
    result: { value: Awaited<ReturnType<T>> | undefined } | { error: unknown },
  ): void => {
    const callers = pending
    pending = []
    for (const caller of callers) {
      if ('error' in result)
        caller.reject(result.error)
      else
        caller.resolve(result.value)
    }
  }

  const invokeFunc = async (): Promise<Awaited<ReturnType<T>> | undefined> => {
    if (!lastArgs)
      return lastResult

    const args = lastArgs
    const thisArg = lastThis
    lastArgs = null
    lastThis = undefined
    try {
      const result = await fn.apply(thisArg, args) as Awaited<ReturnType<T>>
      lastResult = result
      settlePending({ value: result })
      return result
    }
    catch (error) {
      settlePending({ error })
      throw error
    }
  }

  const cancel = (): void => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    lastArgs = null
    lastThis = undefined
    settlePending({ value: lastResult })
  }

  const flush = async (): Promise<Awaited<ReturnType<T>> | undefined> => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
      return invokeFunc()
    }
    return lastResult
  }

  const debounced = function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    lastArgs = args as Parameters<T>
    lastThis = this

    const shouldCallNow = leading && !timeout

    if (timeout)
      clearTimeout(timeout)

    timeout = setTimeout(() => {
      timeout = null
      if (trailing && lastArgs) {
        void invokeFunc().catch(() => {})
        return
      }
      if (pending.length > 0)
        settlePending({ value: lastResult })
    }, wait)

    const result = new Promise<Awaited<ReturnType<T>> | undefined>((resolve, reject) => {
      pending.push({ resolve, reject })
    })

    if (shouldCallNow)
      void invokeFunc().catch(() => {})

    return result
  } as DebouncedFunction<T>

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced
}
