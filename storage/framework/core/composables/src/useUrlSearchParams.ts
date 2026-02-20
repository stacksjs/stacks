import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'
import { defaultWindow } from './_shared'

export interface UseUrlSearchParamsOptions<T extends Record<string, string> = Record<string, string>> {
  /**
   * Initial parameter values.
   */
  initialValue?: T
}

export interface UseUrlSearchParamsReturn {
  /** Reactive record of all current search params. */
  params: Ref<Record<string, string>>
  /** Get a specific param value. */
  get: (key: string) => string | null
  /** Set a specific param value. */
  set: (key: string, value: string) => void
  /** Delete a specific param. */
  delete: (key: string) => void
}

/**
 * Reactive URL search params.
 * Reads and writes query string parameters reactively.
 *
 * @param mode - 'history' for URL search params, 'hash' for hash-based params
 * @param options - Configuration options
 */
export function useUrlSearchParams<T extends Record<string, string> = Record<string, string>>(
  mode: 'history' | 'hash' = 'history',
  options?: UseUrlSearchParamsOptions<T>,
): UseUrlSearchParamsReturn {
  const win = defaultWindow()
  const { initialValue } = options ?? {}

  function readParams(): Record<string, string> {
    if (!win)
      return { ...initialValue }

    let search = ''
    if (mode === 'hash') {
      const hash = win.location.hash
      const idx = hash.indexOf('?')
      search = idx >= 0 ? hash.slice(idx + 1) : ''
    }
    else {
      search = win.location.search.slice(1)
    }

    const result: Record<string, string> = { ...initialValue }
    const searchParams = new URLSearchParams(search)
    searchParams.forEach((value, key) => {
      result[key] = value
    })

    return result
  }

  const params = ref<Record<string, string>>(readParams())

  function writeParams(): void {
    if (!win)
      return

    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params.value)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value)
      }
    }

    const query = searchParams.toString()

    if (mode === 'hash') {
      const basePath = win.location.hash.split('?')[0] || '#'
      win.location.hash = query ? `${basePath}?${query}` : basePath
    }
    else {
      const url = query
        ? `${win.location.pathname}?${query}`
        : win.location.pathname
      win.history.replaceState(win.history.state, '', url)
    }
  }

  function get(key: string): string | null {
    return params.value[key] ?? null
  }

  function set(key: string, value: string): void {
    const current = { ...params.value }
    current[key] = value
    params.value = current
    writeParams()
  }

  function del(key: string): void {
    const current = { ...params.value }
    delete current[key]
    params.value = current
    writeParams()
  }

  // Listen for popstate to update params
  if (win) {
    win.addEventListener('popstate', () => {
      params.value = readParams()
    })

    win.addEventListener('hashchange', () => {
      if (mode === 'hash') {
        params.value = readParams()
      }
    })
  }

  return {
    params,
    get,
    set,
    delete: del,
  }
}
