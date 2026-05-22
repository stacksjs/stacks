/**
 * Boot-time listener auto-discovery (stacksjs/stacks#1878 E-3,
 * carrying forward F-3 from #1874).
 *
 * Background: events package exports a singleton emitter (`listen`,
 * `dispatch`, etc.), but there's no convention-over-configuration
 * path that scans `app/Listeners/**\/*.ts` and wires up every
 * listener at boot. Apps that follow the standard Stacks layout
 * have to manually `import` every listener file from somewhere or
 * their listeners silently never fire.
 *
 * This module adds `discoverListeners(dir)` that walks a directory
 * (default `app/Listeners`), imports each `.ts` / `.js` file, and
 * registers the default export as a listener if it matches a
 * documented shape:
 *
 * ```ts
 * // app/Listeners/SendWelcomeEmail.ts
 * export default {
 *   listensTo: 'user:registered',
 *   handle: async (event) => {
 *     await mail.send({ to: event.user.email, ... })
 *   },
 *   // optional: 'high' | 'normal' | 'low' — higher runs first
 *   priority: 'normal',
 * }
 * ```
 *
 * Errors during import (syntax errors, missing default export,
 * malformed listener shape) are logged but don't halt discovery —
 * one broken listener shouldn't prevent others from registering.
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import process from 'node:process'
import { listen } from './index'
import type { Handler } from './index'

/**
 * Shape of a listener module's default export. The `listensTo`
 * field is the event name (matches the strict type of
 * `StacksEvents` keys via `unknown` for cross-pkg flexibility);
 * `handle` is the actual listener function.
 */
export interface ListenerModule<T = unknown> {
  /** Event name to subscribe to. Required. */
  listensTo: string
  /** Listener function. Required. */
  handle: Handler<T>
  /** Optional human-readable name for logging. Defaults to filename. */
  name?: string
}

interface DiscoverOptions {
  /**
   * Absolute path to the listeners directory. Defaults to
   * `<cwd>/app/Listeners`.
   */
  dir?: string
  /**
   * File extensions to import. Defaults to `['.ts', '.js']`.
   */
  extensions?: string[]
  /**
   * Custom logger. Defaults to `console.warn` / `console.error`
   * for visibility without adding a logging dependency.
   */
  log?: {
    warn?: (msg: string) => void
    error?: (msg: string) => void
    info?: (msg: string) => void
  }
}

/**
 * Walk the listeners directory and register every default-exported
 * listener that matches the `ListenerModule` shape. Returns the
 * count of successfully registered listeners.
 *
 * @example
 * ```ts
 * // In your framework boot path:
 * import { discoverListeners } from '@stacksjs/events'
 *
 * await discoverListeners()  // defaults to app/Listeners
 * // or
 * await discoverListeners({ dir: '/custom/path' })
 * ```
 */
export async function discoverListeners(options: DiscoverOptions = {}): Promise<number> {
  const dir = options.dir ?? join(process.cwd(), 'app', 'Listeners')
  const extensions = options.extensions ?? ['.ts', '.js']
  const logger = {
    warn: options.log?.warn ?? ((msg: string) => console.warn(msg)),
    error: options.log?.error ?? ((msg: string) => console.error(msg)),
    info: options.log?.info ?? ((msg: string) => console.info(msg)),
  }

  if (!existsSync(dir)) {
    // Not an error — many projects don't have a listeners directory.
    // Stay silent so boot logs don't fill with "no listeners found"
    // for every CLI command.
    return 0
  }

  const files = collectFiles(dir, extensions)
  if (files.length === 0) return 0

  let registered = 0
  for (const filepath of files) {
    try {
      const mod = await import(filepath)
      const exported = mod?.default ?? mod
      if (!isListenerModule(exported)) {
        logger.warn(`[events/discover] ${filepath}: default export doesn't match ListenerModule shape ({ listensTo, handle }), skipping`)
        continue
      }
      listen(exported.listensTo as never, exported.handle as never)
      registered++
    }
    catch (err) {
      logger.error(`[events/discover] failed to import ${filepath}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (registered > 0)
    logger.info(`[events/discover] registered ${registered} listener${registered === 1 ? '' : 's'} from ${dir}`)

  return registered
}

/**
 * Recursively collect every file under `dir` with an allowed
 * extension. Symlinks are followed via `fs.statSync` which throws
 * on broken links — those propagate to the caller, who can decide
 * whether to retry or fail.
 */
function collectFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = []
  const entries = readdirSync(dir)
  for (const name of entries) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...collectFiles(full, extensions))
    }
    else if (st.isFile() && extensions.includes(extname(name))) {
      out.push(full)
    }
  }
  return out
}

function isListenerModule(v: unknown): v is ListenerModule {
  return (
    !!v
    && typeof v === 'object'
    && typeof (v as { listensTo?: unknown }).listensTo === 'string'
    && typeof (v as { handle?: unknown }).handle === 'function'
  )
}
