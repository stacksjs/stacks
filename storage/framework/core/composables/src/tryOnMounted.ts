import { onUnmounted } from '@stacksjs/stx'

/**
 * Try to execute a function when mounted (in a component context).
 * If not in a component context, the function is still called.
 */
export function tryOnMounted(fn: () => void): void {
  // In stx, there's no explicit onMounted hook separate from setup.
  // We call immediately since composables are typically called during setup.
  fn()
}

/**
 * Try to execute a function before mount.
 * Runs the function immediately.
 */
export function tryOnBeforeMount(fn: () => void): void {
  fn()
}

/**
 * Try to register an unmount callback. Fails silently outside component context.
 */
export function tryOnUnmounted(fn: () => void): void {
  try {
    onUnmounted(fn)
  }
  catch {
    // Not in a component context
  }
}

/**
 * Try to register a before-unmount callback.
 */
export function tryOnBeforeUnmount(fn: () => void): void {
  try {
    onUnmounted(fn)
  }
  catch {
    // Not in a component context
  }
}

/**
 * Try to run a function when the current scope is disposed.
 */
export function tryOnScopeDispose(fn: () => void): void {
  try {
    onUnmounted(fn)
  }
  catch {
    // Not in a scope context
  }
}
