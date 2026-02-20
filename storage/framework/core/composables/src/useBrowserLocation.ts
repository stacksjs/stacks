import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { defaultWindow } from './_shared'

export interface UseBrowserLocationReturn {
  href: Ref<string>
  protocol: Ref<string>
  host: Ref<string>
  hostname: Ref<string>
  port: Ref<string>
  pathname: Ref<string>
  search: Ref<string>
  hash: Ref<string>
  origin: Ref<string>
}

/**
 * Reactive browser location.
 * Returns reactive refs for each part of window.location.
 * Listens for popstate events to keep refs updated.
 */
export function useBrowserLocation(): UseBrowserLocationReturn {
  const win = defaultWindow()

  function readLocation(): {
    href: string
    protocol: string
    host: string
    hostname: string
    port: string
    pathname: string
    search: string
    hash: string
    origin: string
  } {
    if (!win) {
      return {
        href: '',
        protocol: '',
        host: '',
        hostname: '',
        port: '',
        pathname: '',
        search: '',
        hash: '',
        origin: '',
      }
    }

    return {
      href: win.location.href,
      protocol: win.location.protocol,
      host: win.location.host,
      hostname: win.location.hostname,
      port: win.location.port,
      pathname: win.location.pathname,
      search: win.location.search,
      hash: win.location.hash,
      origin: win.location.origin,
    }
  }

  const initial = readLocation()

  const href = ref(initial.href)
  const protocol = ref(initial.protocol)
  const host = ref(initial.host)
  const hostname = ref(initial.hostname)
  const port = ref(initial.port)
  const pathname = ref(initial.pathname)
  const search = ref(initial.search)
  const hash = ref(initial.hash)
  const origin = ref(initial.origin)

  function update(): void {
    const loc = readLocation()
    href.value = loc.href
    protocol.value = loc.protocol
    host.value = loc.host
    hostname.value = loc.hostname
    port.value = loc.port
    pathname.value = loc.pathname
    search.value = loc.search
    hash.value = loc.hash
    origin.value = loc.origin
  }

  if (win) {
    win.addEventListener('popstate', update)
    win.addEventListener('hashchange', update)

    try {
      onUnmounted(() => {
        win.removeEventListener('popstate', update)
        win.removeEventListener('hashchange', update)
      })
    }
    catch {
      // Not in a component context
    }
  }

  return {
    href,
    protocol,
    host,
    hostname,
    port,
    pathname,
    search,
    hash,
    origin,
  }
}
