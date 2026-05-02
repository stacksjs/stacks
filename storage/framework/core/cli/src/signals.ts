/**
 * Signal-handler registry.
 *
 * Multiple buddy commands and long-running framework subsystems each
 * need to clean up when the user hits Ctrl+C. Wiring `process.on('SIGINT', …)`
 * directly stacks listeners forever — once a process has run several
 * commands in sequence (e.g. tests that spawn `buddy …` repeatedly,
 * or an interactive REPL session), every Ctrl+C fires N callbacks in
 * undefined order, often racing each other to clean up the same
 * resources twice.
 *
 * This module is the single source of truth: callers register a named
 * cleanup via `onSignal('mycommand', cleanup)` and the registry guarantees
 * each name has exactly one active handler. Replacing or removing is
 * O(1) and idempotent.
 */

import process from 'node:process'

type Signal = 'SIGINT' | 'SIGTERM' | 'SIGHUP'
const SIGNALS: readonly Signal[] = ['SIGINT', 'SIGTERM', 'SIGHUP']

/** name → cleanup */
const handlers = new Map<string, () => void | Promise<void>>()

/**
 * One installed listener per signal, regardless of how many cleanups
 * are registered. The listener iterates `handlers` and runs each in
 * registration order.
 */
let installed = false

function installOnce(): void {
  if (installed) return
  installed = true
  for (const sig of SIGNALS) {
    process.on(sig, async () => {
      // Run cleanups in registration order so dependencies (e.g. "stop
      // accepting requests" before "drain the queue") fire correctly.
      // Errors from one cleanup don't block the next — this is a
      // best-effort shutdown path, not a transactional one.
      for (const [name, fn] of handlers) {
        try {
          await fn()
        }
        catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[signals] cleanup '${name}' threw:`, err)
        }
      }
    })
  }
}

/**
 * Register or replace the cleanup for `name`. Returns a disposer that
 * un-registers this specific cleanup; useful in tests to avoid leaking
 * across spec files.
 *
 * @example
 * ```ts
 * import { onSignal } from '@stacksjs/cli'
 *
 * const dispose = onSignal('queue-worker', async () => {
 *   await worker.drain()
 * })
 *
 * // Later, if the worker stops on its own:
 * dispose()
 * ```
 */
export function onSignal(name: string, cleanup: () => void | Promise<void>): () => void {
  installOnce()
  handlers.set(name, cleanup)
  return () => {
    if (handlers.get(name) === cleanup) handlers.delete(name)
  }
}

/**
 * Drop a registered handler by name. Equivalent to invoking the disposer
 * returned by `onSignal`, but useful when the disposer wasn't kept.
 */
export function offSignal(name: string): void {
  handlers.delete(name)
}

/**
 * Snapshot of currently-registered handler names — primarily for tests
 * that want to assert cleanup wiring is in place.
 */
export function listSignalHandlers(): string[] {
  return [...handlers.keys()]
}
