import { registerAppListeners } from '@stacksjs/events'
import { path as p } from '@stacksjs/path'

/**
 * **Event Listener Bootstrap**
 *
 * Registers every listener the application declares: the `app/Events.ts` map of
 * event name to listener names, and any module under `app/Listeners/` that
 * declares its own `listensTo`.
 *
 * This file used to carry its own implementation of the first half - a wildcard
 * handler that read the map on every dispatch and imported the named action out
 * of `app/Actions/`. It was a second implementation of what
 * `registerAppListeners` already does, and having two was worse than having the
 * wrong one:
 *
 *   - In dev they both ran. `injectGlobalAutoImports()` calls
 *     `registerAppListeners()` and the dev API entrypoint then called
 *     `handleEvents()`, so every listener named in the map fired TWICE per
 *     event - two welcome emails, two rows, and no error anywhere to say so.
 *   - The copy resolved names against `app/Actions/` alone, so a listener under
 *     `app/Listeners/` and any of the framework's default actions were
 *     unreachable from the map.
 *   - It matched events by exact name only, dropping the glob subscriptions
 *     (`user:*`) the emitter supports.
 *
 * Delegating keeps this file as the app's hook into boot - override it to
 * register listeners of your own - with one implementation behind it, whose
 * registry also makes the call idempotent across a dev-server reload.
 */
export async function handleEvents(): Promise<number> {
  // Anchored to the project root rather than left to `process.cwd()`. A buddy
  // command, a test runner or a worker started from a subdirectory would
  // otherwise look for `app/Events.ts` beside wherever it happened to be
  // launched, find nothing, and register no listeners without saying so.
  return registerAppListeners({ base: p.projectPath() })
}
