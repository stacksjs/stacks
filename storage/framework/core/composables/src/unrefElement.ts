import type { MaybeRef } from './_shared'
import { unref } from './_shared'

/**
 * Unref a value that may be a ref to an HTML element.
 * Handles the case where the ref value may have an `$el` property (component instance).
 */
export function unrefElement(
  elRef: MaybeRef<HTMLElement | { $el: HTMLElement } | null | undefined>,
): HTMLElement | null | undefined {
  const plain = unref(elRef) as any
  if (!plain) return plain
  // Handle component instances with $el
  if (plain.$el) return plain.$el
  return plain
}
