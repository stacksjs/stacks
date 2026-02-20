import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

/**
 * Reactive state indicating if the component is mounted.
 * Returns a ref that becomes true after the initial execution context.
 */
export function useMounted(): Ref<boolean> {
  const isMounted = ref(false)

  // In stx context, we set mounted after microtask to simulate mount
  Promise.resolve().then(() => {
    isMounted.value = true
  })

  return isMounted
}
