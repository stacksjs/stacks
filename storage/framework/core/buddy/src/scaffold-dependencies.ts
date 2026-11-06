/**
 * Installing a new app's dependencies, for `buddy new`.
 *
 * `pantry install` does two jobs in a scaffold: it installs the system
 * dependencies `deps.yaml` declares (bun, sqlite, git, ...) from the Pantry
 * registry, and it installs the app's JavaScript packages. Only the second is
 * needed to finish the scaffold: every later step runs the app's own
 * `./buddy`, which needs `node_modules`, and none of them needs a system
 * package Pantry would have added.
 *
 * A Pantry failure used to end `buddy new` on the spot, with the template's
 * vendored framework still in place and no `node_modules`: a directory that
 * was neither the template nor an app (stacksjs/stacks#3209, seen while the
 * Pantry registry was unreachable). Now the JavaScript packages are installed
 * with the Bun running `buddy new`, the scaffold finishes, and the caller
 * reports the step that is left. The failure is reported, not hidden: the
 * caller still exits non-zero.
 */

export interface ScaffoldDependencyRunners {
  /** Runs `pantry install`, installing Pantry first if it is missing. Resolves to why it failed, or `null`. */
  pantry: () => Promise<string | null>
  /** Whether the app has its JavaScript packages. */
  hasNodeModules: () => boolean
  /** Runs `bun install` in the app. Resolves to why it failed, or `null`. */
  bunInstall: () => Promise<string | null>
}

export type ScaffoldDependencyOutcome =
  /** Everything is installed. */
  | { status: 'complete' }
  /** The scaffold can finish; the system dependencies still need `pantry install`. */
  | { status: 'system-dependencies-missing', pantryFailure: string }
  /** The scaffold cannot finish: neither installer produced `node_modules`. */
  | { status: 'failed', pantryFailure: string | null, bunFailure: string }

export async function installScaffoldDependencies(run: ScaffoldDependencyRunners): Promise<ScaffoldDependencyOutcome> {
  const pantryFailure = await run.pantry()

  if (pantryFailure === null && run.hasNodeModules())
    return { status: 'complete' }

  // Pantry failed, or reported success without installing the JavaScript
  // packages. Either way they are what the rest of the scaffold needs.
  const bunFailure = await run.bunInstall()
  if (bunFailure !== null)
    return { status: 'failed', pantryFailure, bunFailure }

  if (!run.hasNodeModules())
    return { status: 'failed', pantryFailure, bunFailure: '`bun install` finished without creating node_modules.' }

  if (pantryFailure === null)
    return { status: 'complete' }

  return { status: 'system-dependencies-missing', pantryFailure }
}

/**
 * The Bun to run `bun install` with: the one on PATH, else the Bun running this
 * process. Not the running process when buddy is a compiled binary, where
 * `process.execPath` is buddy itself and `<buddy> install` would run buddy's own
 * `install` command. `null` when there is no Bun to use.
 */
export function bunExecutable(onPath: string | null, execPath: string, compiled: boolean): string | null {
  if (onPath)
    return onPath
  return compiled ? null : execPath
}

/** One line for a failure value an installer produced. */
export function failureReason(error: unknown): string {
  if (error instanceof Error)
    return error.message
  return String(error)
}
