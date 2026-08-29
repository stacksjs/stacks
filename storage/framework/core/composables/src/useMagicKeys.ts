import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseMagicKeysReturn {
  /** Check if a key is currently pressed */
  [key: string]: Ref<boolean> | Ref<Set<string>>
  current: Ref<Set<string>>
}

/**
 * Reactive key press tracking.
 * Returns a proxy that provides reactive boolean refs for any key.
 *
 * @example
 * ```ts
 * const keys = useMagicKeys()
 * whenever(keys['ctrl+s'], () => save())
 * ```
 */
export function useMagicKeys(): Record<string, Ref<boolean>> & { current: Ref<Set<string>> } {
  const current = ref(new Set<string>()) as Ref<Set<string>>
  const refs = new Map<string, Ref<boolean>>()

  function getRef(key: string): Ref<boolean> {
    const lower = key.toLowerCase()
    if (!refs.has(lower)) {
      refs.set(lower, ref(false))
    }
    return refs.get(lower)!
  }

  function updateCombos(): void {
    // Update combination keys like 'ctrl+s'
    for (const [key, r] of refs) {
      if (key.includes('+')) {
        const parts = key.split('+').map(p => p.trim().toLowerCase())
        r.value = parts.every(p => current.value.has(p))
      }
    }
  }

  if (typeof window !== 'undefined') {
    const onKeyDown = (e: KeyboardEvent): void => {
      const key = e.key.toLowerCase()
      current.value.add(key)
      current.value = new Set(current.value) // trigger reactivity
      const r = getRef(key)
      r.value = true

      // Also track modifier aliases
      if (e.ctrlKey) { getRef('ctrl').value = true; current.value.add('ctrl') }
      if (e.shiftKey) { getRef('shift').value = true; current.value.add('shift') }
      if (e.altKey) { getRef('alt').value = true; current.value.add('alt') }
      if (e.metaKey) { getRef('meta').value = true; current.value.add('meta') }

      updateCombos()
    }

    const onKeyUp = (e: KeyboardEvent): void => {
      const key = e.key.toLowerCase()
      current.value.delete(key)
      current.value = new Set(current.value)
      const r = getRef(key)
      r.value = false

      if (!e.ctrlKey) { getRef('ctrl').value = false; current.value.delete('ctrl') }
      if (!e.shiftKey) { getRef('shift').value = false; current.value.delete('shift') }
      if (!e.altKey) { getRef('alt').value = false; current.value.delete('alt') }
      if (!e.metaKey) { getRef('meta').value = false; current.value.delete('meta') }

      updateCombos()
    }

    window.addEventListener('keydown', onKeyDown, { passive: true })
    window.addEventListener('keyup', onKeyUp, { passive: true })

    try {
      onUnmounted(() => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
      })
    }
    catch {
      // Not in a component context
    }
  }

  return new Proxy({ current } as any, {
    get(target, prop: string) {
      if (prop === 'current') return current
      return getRef(prop)
    },
  })
}
