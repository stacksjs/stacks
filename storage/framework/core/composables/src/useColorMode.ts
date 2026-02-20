import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

export type ColorMode = 'dark' | 'light' | 'auto' | (string & {})

export interface UseColorModeOptions {
  /** The attribute to apply the mode to. Default: 'class' */
  attribute?: string
  /** The initial mode. Default: 'auto' */
  initialValue?: ColorMode
  /** Map of modes to attribute values. */
  modes?: Record<string, string>
  /** Storage key. Default: 'color-mode' */
  storageKey?: string
  /** The element to apply the mode to. Default: document.documentElement */
  selector?: string
}

export interface UseColorModeReturn {
  mode: Ref<ColorMode>
  system: Ref<'dark' | 'light'>
  store: Ref<ColorMode>
}

/**
 * Reactive color mode (dark / light / custom) with auto-detection and persistence.
 */
export function useColorMode(options: UseColorModeOptions = {}): UseColorModeReturn {
  const {
    attribute = 'class',
    initialValue = 'auto',
    modes = {},
    storageKey = 'color-mode',
    selector,
  } = options

  const system = ref<'dark' | 'light'>('light') as Ref<'dark' | 'light'>

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    system.value = mq.matches ? 'dark' : 'light'
    mq.addEventListener('change', (e) => {
      system.value = e.matches ? 'dark' : 'light'
    })
  }

  // Restore from storage
  let stored: ColorMode = initialValue
  if (typeof localStorage !== 'undefined') {
    const val = localStorage.getItem(storageKey)
    if (val)
      stored = val as ColorMode
  }

  const store = ref<ColorMode>(stored) as Ref<ColorMode>
  const mode = ref<ColorMode>(store.value === 'auto' ? system.value : store.value) as Ref<ColorMode>

  function applyMode(m: string): void {
    if (typeof document === 'undefined') return
    const el = selector ? document.querySelector(selector) : document.documentElement
    if (!el) return

    const value = modes[m] ?? m

    if (attribute === 'class') {
      // Remove all known mode classes
      const allModes = ['dark', 'light', ...Object.keys(modes), ...Object.values(modes)]
      for (const cls of allModes)
        el.classList.remove(cls)
      if (value)
        el.classList.add(value)
    }
    else {
      el.setAttribute(attribute, value)
    }
  }

  // Watch store for changes
  watch(store, (val) => {
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(storageKey, val)
    mode.value = val === 'auto' ? system.value : val
  })

  // Watch system changes (for auto mode)
  watch(system, (val) => {
    if (store.value === 'auto')
      mode.value = val
  })

  // Watch mode for applying
  watch(mode, (val) => {
    applyMode(val)
  })

  // Apply initial mode
  applyMode(mode.value)

  return { mode, system, store }
}
