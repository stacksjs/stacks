export interface DebounceOptions {
  leading?: boolean
  trailing?: boolean
}

export function debounce<T extends (..._args: any[]) => any>(
  fn: T,
  wait: number = 0,
  options: DebounceOptions = {},
): T & { cancel: () => void, flush: () => void } {
  const { leading = false, trailing = true } = options

  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  let lastThis: any = null
  let result: any

  const invokeFunc = () => {
    if (lastArgs) {
      result = fn.apply(lastThis, lastArgs)
      lastArgs = null
      lastThis = null
    }
    return result
  }

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    lastArgs = null
    lastThis = null
  }

  const flush = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
      return invokeFunc()
    }
    return result
  }

  const debounced = function (this: any, ...args: any[]) {
    lastArgs = args
    lastThis = this

    const shouldCallNow = leading && !timeout

    if (timeout)
      clearTimeout(timeout)

    timeout = setTimeout(() => {
      timeout = null
      if (trailing && lastArgs)
        invokeFunc()
    }, wait)

    if (shouldCallNow)
      return invokeFunc()

    return result
  } as T & { cancel: () => void, flush: () => void }

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced
}
