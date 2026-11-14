/** The compiled stx messenger supplies this interface; no page globals are used. */
export interface SupportWidget {
  boot: (options: { url: string, project: string, token?: string, locale?: string }) => Promise<void>
  open: () => void
  close: () => void
  update: (options: { token?: string, locale?: string }) => void | Promise<void>
  track: (event: string, attributes?: Record<string, string | number | boolean | null>) => Promise<unknown>
  shutdown: () => void
}

export interface BrowserBootOptions {
  endpoint?: string
  project: string
  sessionToken?: string
  locale?: string
}

export interface SupportBrowser {
  boot: (options: BrowserBootOptions) => Promise<void>
  open: () => void
  close: () => void
  update: (options: { sessionToken?: string, locale?: string }) => Promise<void>
  track: (event: string, attributes?: Record<string, string | number | boolean | null>) => Promise<void>
  shutdown: () => void
}

/** Customer credentials remain properties, never reflected into HTML attributes. */
export function createSupportBrowser(widget: SupportWidget): SupportBrowser {
  let booted = false
  let generation = 0
  let booting = false

  function requireBoot(): void {
    if (!booted) throw new Error('HQ.support messenger is not booted.')
  }

  return {
    async boot(options) {
      if (!options.project?.trim()) throw new Error('HQ.support project is required.')
      if (booting) throw new Error('HQ.support messenger is already booting.')
      if (booted) widget.shutdown()
      booted = false
      booting = true
      const current = ++generation
      try {
        await widget.boot({ url: options.endpoint ?? 'https://hq.support', project: options.project, token: options.sessionToken, locale: options.locale })
        if (current === generation) booted = true
        else widget.shutdown()
      }
      catch (error) { widget.shutdown(); throw error }
      finally { booting = false }
    },
    open() { requireBoot(); widget.open() },
    close() { requireBoot(); widget.close() },
    async update(options) {
      requireBoot()
      await widget.update({ token: options.sessionToken, locale: options.locale })
    },
    async track(event, attributes) {
      requireBoot()
      if (!event.trim()) throw new Error('HQ.support event is required.')
      await widget.track(event, attributes)
    },
    shutdown() {
      if (!booted && !booting) return
      generation++
      booted = false
      widget.shutdown()
    },
  }
}

export interface NativeSupportMount {
  refresh: () => Promise<void>
  shutdown: () => void
}
export interface NativeSupportMountOptions {
  /** The native app access token, if it uses bearer auth rather than HttpOnly cookies. */
  getToken?: () => string | null | undefined
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
  load?: (url: string) => Promise<{ createSupport: (options: { container: HTMLElement, inline?: boolean }) => SupportBrowser }>
  events?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
  onError?: (code: 'unavailable') => void
}

/** Opt-in native layout bridge. Every refresh clears the previous customer's state first. */
export function mountNativeSupport(container: HTMLElement, options: NativeSupportMountOptions = {}): NativeSupportMount {
  const fetcher = options.fetch ?? globalThis.fetch
  const load = options.load ?? (async (url: string) => await import(/* @vite-ignore */ url))
  const events = options.events ?? (typeof globalThis.addEventListener === 'function' ? globalThis : undefined)
  let active: SupportBrowser | undefined, epoch = 0, disposed = false, abort: AbortController | undefined
  function clear() { epoch++; abort?.abort(); active?.shutdown(); active = undefined }
  const controller: NativeSupportMount = {
    async refresh() {
      if (disposed) return
      clear()
      const current = epoch
      abort = new AbortController()
      const init: RequestInit = { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]) }
      try {
        const response = await fetcher('/api/support/config', init)
        if (!response.ok) return
        const config: unknown = await response.json()
        if (!config || typeof config !== 'object') throw new Error('Configuration unavailable')
        const value = config as Record<string, unknown>
        if (value.enabled !== true) return
        if (typeof value.project !== 'string' || !value.project || value.sessionEndpoint !== '/api/support/session' || typeof value.endpoint !== 'string' || typeof value.loaderUrl !== 'string') throw new Error('Configuration unavailable')
        for (const input of [value.endpoint, value.loaderUrl]) {
          const url = new URL(input)
          if (url.username || url.password || url.hash || url.search || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Invalid support origin')
        }
        const csrfResponse = await fetcher('/api/csrf-token', init)
        if (!csrfResponse.ok) throw new Error('Session unavailable')
        const csrf = await csrfResponse.json() as { token?: unknown }
        if (typeof csrf.token !== 'string') throw new Error('Session unavailable')
        const token = options.getToken?.()
        const sessionResponse = await fetcher('/api/support/session', { ...init, method: 'POST', headers: { Accept: 'application/json', 'x-csrf-token': csrf.token, ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
        if (sessionResponse.status === 401 || sessionResponse.status === 403) return
        if (!sessionResponse.ok) throw new Error('Session unavailable')
        const session = await sessionResponse.json() as { token?: unknown }
        if (typeof session.token !== 'string' || !session.token) throw new Error('Session unavailable')
        if (disposed || current !== epoch) return
        const module = await load(value.loaderUrl)
        if (disposed || current !== epoch) return
        const next = module.createSupport({ container, inline: false })
        active = next
        await next.boot({ project: value.project, endpoint: value.endpoint, sessionToken: session.token, locale: typeof value.locale === 'string' ? value.locale : 'en' })
        if (disposed || current !== epoch) next.shutdown()
      }
      catch {
        if (!disposed && current === epoch) { clear(); options.onError?.('unavailable') }
      }
    },
    shutdown() {
      disposed = true
      clear()
      for (const name of ['stx:navigate', 'stacks:auth-changed']) events?.removeEventListener(name, refresh)
      events?.removeEventListener('storage', storage)
      events?.removeEventListener('pagehide', clear)
      events?.removeEventListener('stacks:auth-changing', clear)
    },
  }
  const refresh = () => { void controller.refresh() }
  const storage = (event: Event) => { const key = (event as StorageEvent).key; if (key === null || /auth|token|session/i.test(key)) refresh() }
  for (const name of ['stx:navigate', 'stacks:auth-changed']) events?.addEventListener(name, refresh)
  events?.addEventListener('storage', storage)
  events?.addEventListener('pagehide', clear)
  events?.addEventListener('stacks:auth-changing', clear)
  return controller
}
