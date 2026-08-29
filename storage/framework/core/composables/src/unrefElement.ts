import type { MaybeRef } from './_shared'
import { unref } from './_shared'

/**
 * Unref a value that may be a ref to an HTML element.
 * Handles the case where the ref value may have an `$el` property (component instance).
 */
export function unrefElement(
  elRef: MaybeRef<HTMLElement | { $el: HTMLElement } | null | undefined>,
): HTMLElement | null | undefined {
  const plain = unref(elRef)
  if (!plain) return plain

  // Handle component instances with $el. Narrowed with `in` rather than read
  // off a cast: the union genuinely has two arms, and only one of them has
  // `$el` - reading it blind was how a plain element could be returned as a
  // component wrapper.
  if ('$el' in plain) return plain.$el

  return plain
}
