/**
 * Reaching Craft's bridge at the right moment.
 *
 * Craft's iOS shell injects `window.craft` at document start, but an older
 * shell installs it once the page has finished loading. A call made before
 * then used to find no bridge and quietly take the web path: a secure-storage
 * read answered from localStorage, a confirm drew the browser's own dialog.
 * Inside a native host, a call now waits for the bridge (briefly: a host that
 * never installs one gets the web fallback after `BRIDGE_WAIT_MS`), and only a
 * browser takes the fallback at once.
 */

/** How long a call waits for a native host's bridge before using the web fallback. */
export const BRIDGE_WAIT_MS = 2500

export interface CraftHost extends EventTarget {
  craft?: unknown
  CraftAndroid?: unknown
  webkit?: { messageHandlers?: Record<string, unknown> }
  document?: Document
  navigator?: Navigator
}

/** The page's window, when there is one. */
export function craftHost(): CraftHost | undefined {
  if (typeof window === 'undefined') return undefined
  return window as unknown as CraftHost
}

/** `window.craft`, the bridge object, once installed. */
export function craftRoot(): Record<string, any> | undefined {
  const bridge = craftHost()?.craft
  return bridge && typeof bridge === 'object' ? bridge as Record<string, any> : undefined
}

function userAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
}

/**
 * Whether this page runs inside Craft's phone shell, before the bridge exists.
 *
 * Craft installs `window.craft` once the page has finished loading on an older
 * shell — images and all — so a bridge check answers `false` during setup on
 * a phone, and a layout that decides then renders the website's chrome in the
 * app. The transports are there from the start: Android's `CraftAndroid`
 * interface, and on iOS the `craft` message handler. Craft's macOS windows
 * carry that handler too, so on iOS an iPhone or iPad user agent is what makes
 * it the phone app.
 */
export function hasNativeMobileHost(): boolean {
  const host = craftHost()
  if (!host) return false
  if (host.CraftAndroid) return true
  return Boolean(host.webkit?.messageHandlers?.craft) && /iPhone|iPad|iPod/.test(userAgent())
}

/** A native host whose bridge object is not installed yet: worth waiting for. */
export function bridgePending(): boolean {
  const host = craftHost()
  if (!host || host.craft) return false
  return hasNativeMobileHost() || Boolean(host.webkit?.messageHandlers?.craft)
}

/**
 * Resolves once the bridge object (`window.craft`) is installed: `true` then,
 * `false` in a browser at once, or after `timeoutMs` in a host that never
 * installs it.
 *
 * Not whenNativeMobile(), which answers `true` as soon as the phone shell is
 * recognisable, before the bridge exists and before anything can be asked of it.
 */
export function whenBridgeReady(timeoutMs = 15_000): Promise<boolean> {
  const current = craftHost()
  if (current?.craft) return Promise.resolve(true)
  if (!current || !bridgePending()) return Promise.resolve(false)

  return new Promise<boolean>((resolve) => {
    const done = (): void => {
      clearTimeout(timer)
      current.removeEventListener('craftReady', done)
      resolve(Boolean(current.craft))
    }
    const timer = setTimeout(done, timeoutMs)
    current.addEventListener('craftReady', done)
  })
}

function lookup(root: Record<string, any> | undefined, path: string): ((...args: any[]) => unknown) | null {
  if (!root) return null
  const parts = path.split('.')
  let owner: any = root
  for (const part of parts.slice(0, -1)) {
    owner = owner?.[part]
    if (!owner || (typeof owner !== 'object' && typeof owner !== 'function')) return null
  }
  const fn = owner?.[parts[parts.length - 1] as string]
  return typeof fn === 'function' ? fn.bind(owner) : null
}

/**
 * The bridge function at `path` (`'dialog.confirm'`), or null when this host
 * has none. Synchronous: no waiting for a bridge still on its way.
 */
export function nativeFunctionNow(path: string): ((...args: any[]) => unknown) | null {
  return lookup(craftRoot(), path)
}

/**
 * The bridge function at `path`, waiting for a native host's bridge to arrive
 * first. Null in a browser, on a shell that predates the API, or when the
 * bridge did not come within `timeoutMs`.
 */
export async function nativeFunction(path: string, timeoutMs = BRIDGE_WAIT_MS): Promise<((...args: any[]) => unknown) | null> {
  const now = nativeFunctionNow(path)
  if (now || !bridgePending()) return now
  await whenBridgeReady(timeoutMs)
  return nativeFunctionNow(path)
}

export interface CallNativeOptions {
  /** Take the fallback when the native call fails, rather than rethrowing. */
  fallbackOnError?: boolean
  timeoutMs?: number
}

/**
 * Calls the bridge function at `path`, or `fallback` where there is none.
 *
 * Inside a native host whose bridge is still loading, the call is held until
 * it arrives, so an early call reaches the native implementation rather than
 * the web one.
 */
export async function callNative<T>(
  path: string,
  args: unknown[],
  fallback: () => T | Promise<T>,
  options: CallNativeOptions = {},
): Promise<T> {
  const fn = await nativeFunction(path, options.timeoutMs)
  if (!fn) return fallback()
  try {
    return await fn(...args) as T
  }
  catch (error) {
    if (options.fallbackOnError) return fallback()
    throw error
  }
}

/**
 * Runs `run` once a native host's bridge is installed: at once when it is
 * there or in a browser, after it arrives (or `BRIDGE_WAIT_MS` passes) in a
 * host still loading it.
 *
 * craft-native's services read `window.craft` at call time and take their web
 * path when it is missing, which during an older shell's launch it is. The
 * services this package exports call through here, as plain object literals
 * rather than wrapped at import: a bundler drops an object literal nobody
 * imports, and could not drop a call made at module scope once minified.
 */
export async function afterBridge<T>(run: () => T | Promise<T>, timeoutMs = BRIDGE_WAIT_MS): Promise<T> {
  if (bridgePending()) await whenBridgeReady(timeoutMs)
  return run()
}

/**
 * Subscribes once the bridge can take the subscription: at once when it is
 * there or in a browser, otherwise when it arrives. The returned function
 * unsubscribes either way, including before the subscription was made.
 */
export function subscribeWhenReady(subscribe: () => (() => void) | void, timeoutMs = BRIDGE_WAIT_MS): () => void {
  let stop: (() => void) | void
  let cancelled = false
  if (!bridgePending()) {
    stop = subscribe()
  }
  else {
    void whenBridgeReady(timeoutMs).then(() => {
      if (!cancelled) stop = subscribe()
    })
  }
  return () => {
    cancelled = true
    if (typeof stop === 'function') stop()
  }
}

/** Listens for a Craft DOM event on the window; the detail is passed through. */
export function onCraftEvent<T = Record<string, unknown>>(name: string, callback: (detail: T) => void): () => void {
  const host = craftHost()
  if (!host) return () => {}
  const listener = (event: Event): void => callback(((event as CustomEvent).detail ?? {}) as T)
  host.addEventListener(name, listener)
  return () => host.removeEventListener(name, listener)
}
