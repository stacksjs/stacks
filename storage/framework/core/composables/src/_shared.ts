import type { Ref } from '@stacksjs/stx'

/**
 * A value that may be a raw value or a Ref.
 */
export type MaybeRef<T> = T | Ref<T>

/**
 * A value that may be a raw value, a Ref, or a getter function.
 */
export type MaybeRefOrGetter<T> = T | Ref<T> | (() => T)

/**
 * Unwrap a MaybeRef to its raw value.
 */
export function unref<T>(val: MaybeRef<T>): T {
  if (val && typeof val === 'object' && 'value' in val && 'subscribe' in val) {
    return (val as Ref<T>).value
  }
  return val as T
}

/**
 * Unwrap a MaybeRefOrGetter to its raw value.
 */
export function toValue<T>(val: MaybeRefOrGetter<T>): T {
  if (typeof val === 'function') {
    return (val as () => T)()
  }
  return unref(val)
}

/**
 * Check if a value is a Ref.
 */
export function isRef<T>(val: MaybeRef<T>): val is Ref<T> {
  return val !== null && typeof val === 'object' && 'value' in val && 'subscribe' in val
}

/**
 * No-op function for default callbacks.
 */
export function noop(): void {}

/**
 * Type helper for configurable window.
 */
export interface ConfigurableWindow {
  window?: Window
}

/**
 * Type helper for configurable document.
 */
export interface ConfigurableDocument {
  document?: Document
}

/**
 * Get the default window, SSR-safe.
 */
export function defaultWindow(): Window | undefined {
  return typeof window !== 'undefined' ? window : undefined
}

/**
 * Get the default document, SSR-safe.
 */
export function defaultDocument(): Document | undefined {
  return typeof document !== 'undefined' ? document : undefined
}

/**
 * Get the default navigator, SSR-safe.
 */
export function defaultNavigator(): Navigator | undefined {
  return typeof navigator !== 'undefined' ? navigator : undefined
}
