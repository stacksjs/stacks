/**
 * The phone's own pull-to-refresh (a UIRefreshControl on the web view's scroll
 * view), shared by every screen that asks for it.
 *
 * There is one control for the whole web view, while a router that keeps each
 * tab's screens alive can hold several pull-to-refresh screens at once, all
 * but one hidden. So the control is on while a screen in view wants it and off
 * otherwise, and a pull refreshes the screen in view, never a hidden one.
 */
import { refresh } from './native'

interface Target {
  element: HTMLElement
  tintColor?: string
  run: () => unknown
}

const targets = new Set<Target>()
let enabled = false
let stopListening: (() => void) | null = null

/** Whether an element is laid out in view: connected, and not inside something hidden. */
export function isShown(element: HTMLElement): boolean {
  return element.isConnected && element.getClientRects().length > 0
}

function shownTarget(): Target | undefined {
  return [...targets].find(target => isShown(target.element))
}

function sync(): void {
  const target = shownTarget()
  const want = Boolean(target)
  if (want === enabled) return
  enabled = want
  if (want) void refresh.enable(target?.tintColor ? { tintColor: target.tintColor } : {})
  else void refresh.disable()
}

function onPull(): void {
  const target = shownTarget()
  if (!target) {
    void refresh.end()
    return
  }
  void Promise.resolve()
    .then(() => target.run())
    .catch(() => {})
    .finally(() => refresh.end())
}

export interface NativeRefreshOptions {
  /** The spinner's colour, a CSS colour. */
  tintColor?: string
  /** Runs once per pull; the spinner ends when it settles. */
  onRefresh: () => unknown
}

/**
 * Refreshes the screen `element` belongs to with the native control, for as
 * long as the returned function is not called. Check `refresh.isAvailable()`
 * first: a shell without the control needs the web gesture instead.
 */
export function observeNativeRefresh(element: HTMLElement, options: NativeRefreshOptions): () => void {
  const target: Target = { element, tintColor: options.tintColor, run: options.onRefresh }
  targets.add(target)
  const view = element.ownerDocument?.defaultView
  if (!stopListening) {
    const stopPull = refresh.onRefresh(onPull)
    // A navigation shows another screen, which may or may not want the
    // control. One that does not and is pulled anyway ends the spinner at
    // once (onPull), so a missed navigation costs a flicker, not a refresh.
    const resync = (): void => sync()
    view?.addEventListener('stx:load', resync)
    stopListening = () => {
      stopPull()
      view?.removeEventListener('stx:load', resync)
    }
  }
  sync()
  // A screen mounting is not laid out yet; ask again once it has been.
  view?.requestAnimationFrame?.(() => sync())
  return () => {
    targets.delete(target)
    if (targets.size === 0) {
      stopListening?.()
      stopListening = null
    }
    sync()
  }
}
