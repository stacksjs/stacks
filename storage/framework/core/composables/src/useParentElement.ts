import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

/**
 * Get the parent element of a given element.
 */
export function useParentElement(element?: MaybeRef<HTMLElement | null | undefined>): Ref<HTMLElement | null> {
  const parent = ref<HTMLElement | null>(null) as Ref<HTMLElement | null>

  const el = unref(element) as HTMLElement | null | undefined
  if (el)
    parent.value = el.parentElement

  return parent
}
