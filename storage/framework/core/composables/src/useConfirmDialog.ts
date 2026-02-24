import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'
import { createEventHook } from './createEventHook'

export interface UseConfirmDialogReturn<T = any, C = any> {
  /** Whether the dialog is currently revealed */
  isRevealed: Ref<boolean>
  /** Reveal the dialog, optionally passing data */
  reveal: (data?: T) => Promise<{ data?: C, isCanceled: boolean }>
  /** Confirm the dialog, optionally passing result data */
  confirm: (data?: C) => void
  /** Cancel the dialog */
  cancel: () => void
  /** Hook called when confirm is invoked */
  onConfirm: (fn: (data?: C) => void) => { off: () => void }
  /** Hook called when cancel is invoked */
  onCancel: (fn: () => void) => { off: () => void }
  /** Hook called when reveal is invoked */
  onReveal: (fn: (data?: T) => void) => { off: () => void }
}

/**
 * Create a confirm dialog composable with reveal/confirm/cancel flow.
 */
export function useConfirmDialog<T = any, C = any>(): UseConfirmDialogReturn<T, C> {
  const isRevealed = ref(false) as Ref<boolean>
  const confirmHook = createEventHook<C | undefined>()
  const cancelHook = createEventHook<void>()
  const revealHook = createEventHook<T | undefined>()

  let resolvePromise: ((_result: { data?: C, isCanceled: boolean }) => void) | null = null

  function reveal(data?: T): Promise<{ data?: C, isCanceled: boolean }> {
    isRevealed.value = true
    revealHook.trigger(data)

    return new Promise<{ data?: C, isCanceled: boolean }>((resolve) => {
      resolvePromise = resolve
    })
  }

  function confirm(data?: C): void {
    isRevealed.value = false
    confirmHook.trigger(data)
    resolvePromise?.({ data, isCanceled: false })
    resolvePromise = null
  }

  function cancel(): void {
    isRevealed.value = false
    cancelHook.trigger(undefined as void)
    resolvePromise?.({ isCanceled: true })
    resolvePromise = null
  }

  return {
    isRevealed,
    reveal,
    confirm,
    cancel,
    onConfirm: confirmHook.on,
    onCancel: cancelHook.on,
    onReveal: revealHook.on,
  }
}
