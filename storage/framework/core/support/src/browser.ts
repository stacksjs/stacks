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
