import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export type KeyModifier = 'Alt' | 'AltGraph' | 'CapsLock' | 'Control' | 'Fn' | 'FnLock' | 'Meta' | 'NumLock' | 'ScrollLock' | 'Shift' | 'Symbol' | 'SymbolLock'

/**
 * Reactive key modifier state (e.g., Shift, Control, Alt, Meta).
 */
export function useKeyModifier(modifier: KeyModifier): Ref<boolean> {
  const state = ref(false)

  if (typeof window === 'undefined')
    return state

  const handler = (e: KeyboardEvent | MouseEvent): void => {
    state.value = e.getModifierState(modifier)
  }

  window.addEventListener('keydown', handler, { passive: true })
  window.addEventListener('keyup', handler, { passive: true })
  window.addEventListener('mousedown', handler, { passive: true })
  window.addEventListener('mouseup', handler, { passive: true })

  try {
    onUnmounted(() => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keyup', handler)
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('mouseup', handler)
    })
  }
  catch {
    // Not in a component context
  }

  return state
}
