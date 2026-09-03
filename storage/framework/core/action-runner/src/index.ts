/**
 * How a package runs an action by name.
 *
 * Running an action belongs to `@stacksjs/actions`: it resolves the action
 * file and spawns it. But three packages need to ask for that without being
 * the action layer -
 *
 *   - `@stacksjs/queue`, when a job names an action instead of handing over a
 *     function
 *   - `@stacksjs/scheduler`, for `Schedule.action('...')`
 *   - `@stacksjs/dns`, whose `addDomain` / `removeDomain` shell out to the
 *     domain actions
 *
 * and `@stacksjs/actions` imports all three. Importing it back closed a cycle
 * in every case. So the capability is declared here, in a package that depends
 * on nothing that can lead back, and the action layer supplies it by the act of
 * being imported at all.
 */

import type { Action } from '@stacksjs/enums'
import type { ActionOptions } from '@stacksjs/types'

/**
 * The options a runner accepts, matching `runAction`'s own second parameter.
 * `DeployOptions` and friends are interfaces, so a structural stand-in like
 * `Record<string, unknown>` would not accept them.
 */
export type ActionRunner = (action: Action | string, options?: ActionOptions) => Promise<any>

let registered: ActionRunner | null = null

/**
 * Supply the runner. Called by `@stacksjs/actions` on import; an application
 * embedding any of these packages on its own can call it with a runner of its
 * own.
 */
export function setActionRunner(runner: ActionRunner): void {
  registered = runner
}

/** The registered runner, if the action layer has been loaded. */
export function getActionRunner(): ActionRunner | null {
  return registered
}

/**
 * Run an action by name.
 *
 * Prefers whatever registered itself. Falls back to importing the action
 * package directly, because a worker or a scheduler process can reach a task
 * before anything has pulled the action layer in - that import is the old
 * behaviour, kept so this cannot break a caller that was working.
 *
 * When neither is available it throws. Silently doing nothing would leave a
 * job marked complete, or a scheduled task reported as run, with its work
 * undone - the one outcome these callers must never produce.
 */
export async function runNamedAction(action: Action | string, options?: ActionOptions): Promise<any> {
  if (registered)
    return await registered(action, options)

  const actionsPackage = '@stacksjs/actions'
  const loaded = await import(actionsPackage).catch(() => null) as { runAction?: ActionRunner } | null

  if (loaded?.runAction) {
    // Cache it, so a caller pays the resolution once rather than per call.
    registered = loaded.runAction
    return await registered(action, options)
  }

  throw new Error(
    `Asked to run the action "${action}", but no action runner is available. `
    + `Import @stacksjs/actions in this process, or register one with `
    + `setActionRunner() from @stacksjs/action-runner.`,
  )
}
