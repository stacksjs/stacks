import type { Ref } from '@stacksjs/stx'

/**
 * Extend a ref with additional properties.
 *
 * @param ref - The ref to extend
 * @param extend - The properties to add
 * @returns The extended ref
 */
export function extendRef<T, E extends Record<string, any>>(
  r: Ref<T>,
  extend: E,
): Ref<T> & E {
  for (const [key, value] of Object.entries(extend)) {
    if (key !== 'value')
      (r as any)[key] = value
  }
  return r as Ref<T> & E
}
