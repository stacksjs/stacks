import { state } from '@stacksjs/stx'

/**
 * Lightweight global toast notification system for the dashboard.
 *
 * Why this exists: every commerce/CMS composable was swallowing fetch
 * failures with `console.error`, which is invisible to the user — they'd
 * click "Save" and see nothing happen. `pushToast()` surfaces the result
 * via the `<ToastList>` rendered in the dashboard layout.
 *
 * Usage from a composable:
 *
 *   try { ... }
 *   catch (err) {
 *     pushToast('error', 'Failed to save customer', { detail: String(err) })
 *   }
 *
 * Usage from a `<script client>` block: import `useToasts` and call
 * `pushToast(...)` directly.
 *
 * The store is a `state()` signal so templates can iterate it with
 * `@foreach(toasts() as toast)` and stay reactive. Toasts live in
 * memory only — they intentionally do NOT persist across reloads,
 * since stale "Failed to save 30 minutes ago" messages would be
 * worse than no message.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  readonly id: number
  readonly type: ToastType
  readonly title: string
  /** Secondary line — typically the underlying error message. */
  readonly detail?: string
  /** Auto-dismiss in ms. 0 = sticky (user must dismiss). */
  readonly durationMs: number
  /** Wall-clock timestamp at push time, for ordering / display. */
  readonly createdAt: number
}

export interface PushToastOptions {
  detail?: string
  /** Override the default auto-dismiss duration (ms). 0 to make sticky. */
  durationMs?: number
}

const toasts = state<Toast[]>([])
let nextId = 1

// Errors get longer dwell because a user might need to read & screenshot.
// Success is short — it's just a "yep, that worked" pat on the back.
const DEFAULT_DURATION_MS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
}

export function pushToast(type: ToastType, title: string, opts: PushToastOptions = {}): number {
  const id = nextId++
  const durationMs = opts.durationMs ?? DEFAULT_DURATION_MS[type]
  const toast: Toast = {
    id,
    type,
    title,
    detail: opts.detail,
    durationMs,
    createdAt: Date.now(),
  }
  toasts.update(arr => [...arr, toast])

  if (durationMs > 0 && typeof globalThis.setTimeout === 'function') {
    globalThis.setTimeout(() => dismissToast(id), durationMs)
  }

  return id
}

export function dismissToast(id: number): void {
  toasts.update(arr => arr.filter(t => t.id !== id))
}

export function clearAllToasts(): void {
  toasts.set([])
}

export function useToasts() {
  return {
    toasts,
    pushToast,
    dismissToast,
    clearAllToasts,
  }
}
