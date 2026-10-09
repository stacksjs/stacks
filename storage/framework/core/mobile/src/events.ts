/**
 * What the phone tells the page about itself: its appearance settings, coming
 * back to the front, running short of memory, and the background work iOS
 * wakes the app for.
 */
import { background } from './native'
import { craftHost, onCraftEvent } from './bridge'

export interface NativeAppearance {
  /** UIContentSizeCategory, e.g. `UICTContentSizeCategoryL`. */
  contentSizeCategory?: string
  /** The Dynamic Type text size relative to the default: 1 at Large. */
  fontScale: number
  reduceMotion: boolean
  reduceTransparency: boolean
  colorScheme: 'light' | 'dark'
}

function matches(query: string): boolean {
  const host = craftHost() as unknown as { matchMedia?: (query: string) => { matches: boolean } } | undefined
  try {
    return Boolean(host?.matchMedia?.(query).matches)
  }
  catch {
    return false
  }
}

function flag(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value !== 'false' && value !== '0'
}

/**
 * The appearance as it stands. The shell writes `--craft-font-scale` and
 * `data-craft-reduce-*` on the root element before the page runs, so this is
 * right at setup too; elsewhere it reads the media queries.
 */
export function currentAppearance(): NativeAppearance {
  const root = craftHost()?.document?.documentElement
  const scale = Number.parseFloat(root?.style?.getPropertyValue('--craft-font-scale') || '')
  return {
    fontScale: Number.isFinite(scale) && scale > 0 ? scale : 1,
    reduceMotion: flag(root?.getAttribute('data-craft-reduce-motion')) || matches('(prefers-reduced-motion: reduce)'),
    reduceTransparency: flag(root?.getAttribute('data-craft-reduce-transparency')) || matches('(prefers-reduced-transparency: reduce)'),
    colorScheme: root?.classList?.contains('dark') || matches('(prefers-color-scheme: dark)') ? 'dark' : 'light',
  }
}

/** A `craftAppearance` detail, made whole. */
export function normalizeAppearance(detail: Partial<NativeAppearance> | null | undefined): NativeAppearance {
  const fallback = currentAppearance()
  const scale = Number(detail?.fontScale)
  return {
    contentSizeCategory: typeof detail?.contentSizeCategory === 'string' ? detail.contentSizeCategory : undefined,
    fontScale: Number.isFinite(scale) && scale > 0 ? scale : fallback.fontScale,
    reduceMotion: typeof detail?.reduceMotion === 'boolean' ? detail.reduceMotion : fallback.reduceMotion,
    reduceTransparency: typeof detail?.reduceTransparency === 'boolean' ? detail.reduceTransparency : fallback.reduceTransparency,
    colorScheme: detail?.colorScheme === 'dark' || detail?.colorScheme === 'light' ? detail.colorScheme : fallback.colorScheme,
  }
}

/**
 * Calls `callback` with the appearance now and whenever the phone's settings
 * change (Dynamic Type, Reduce Motion, Reduce Transparency, Light/Dark).
 */
export function onAppearance(callback: (appearance: NativeAppearance) => void, options: { immediate?: boolean } = {}): () => void {
  if (options.immediate !== false) callback(currentAppearance())
  return onCraftEvent<Partial<NativeAppearance>>('craftAppearance', detail => callback(normalizeAppearance(detail)))
}

/** The app came back to the front after `backgroundedMs` away. */
export function onResume(callback: (detail: { backgroundedMs: number }) => void): () => void {
  return onCraftEvent<{ backgroundedMs?: unknown }>('craftResume', detail => callback({ backgroundedMs: Number(detail.backgroundedMs) || 0 }))
}

/** iOS is short of memory: drop caches that can be rebuilt. */
export function onMemoryWarning(callback: () => void): () => void {
  return onCraftEvent('craftMemoryWarning', () => callback())
}

/**
 * Runs `handler` for background work, then tells iOS it is finished: `true`
 * when it resolved, `false` when it threw. iOS gives the app about 30
 * seconds, and the shell ends the task itself at 25 if nothing has.
 */
function backgroundHandler<T>(handler: (detail: T) => unknown): (detail: T) => void {
  return (detail) => {
    void Promise.resolve()
      .then(() => handler(detail))
      .then(() => background.complete(true), () => background.complete(false))
  }
}

/** A content-available push arrived. The handler's settling completes it. */
export function onSilentPush(handler: (payload: Record<string, unknown>) => unknown): () => void {
  const run = backgroundHandler(handler)
  return onCraftEvent<{ payload?: Record<string, unknown> }>('craftSilentPush', detail => run(detail.payload ?? {}))
}

/** iOS woke the app to refresh (BGAppRefreshTask). The handler's settling completes it. */
export function onBackgroundRefresh(handler: () => unknown): () => void {
  const run = backgroundHandler(() => handler())
  return onCraftEvent('craftBackgroundRefresh', () => run(undefined))
}
