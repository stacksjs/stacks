/**
 * How a queued job runs an action it names by string.
 *
 * A job may hand over a function to call, or it may name an action:
 *
 * ```ts
 * export default new Job({ action: 'SendWelcomeEmail' })
 * ```
 *
 * Running that action is `@stacksjs/actions`' job, not this package's. This
 * used to be a direct `await import('@stacksjs/actions')` at both call sites,
 * which made the queue depend on the action layer above it - and with the
 * router and the ORM already in the loop, that single edge held ten packages
 * inside the framework's dependency cycle.
 *
 * So the queue declares what it needs and the action layer supplies it.
 * `@stacksjs/actions` registers `runAction` here when it is imported, which is
 * every process that has actions to run.
 */

export type ActionRunner = (action: string) => Promise<unknown>

let registered: ActionRunner | null = null

/**
 * Supply the runner. Called by `@stacksjs/actions` on import; an application
 * embedding the queue on its own can call it with a runner of its own.
 */
export function setActionRunner(runner: ActionRunner): void {
  registered = runner
}

/** The registered runner, if the action layer has been loaded. */
export function getActionRunner(): ActionRunner | null {
  return registered
}

/**
 * Run an action a job named.
 *
 * Prefers whatever registered itself. Falls back to importing the action
 * package directly, because a worker process can reach a job before anything
 * has pulled the action layer in - that import is the old behaviour, kept so
 * this change cannot break a queue that was working.
 *
 * When neither is available the job fails loudly. Silently doing nothing
 * would leave a job marked complete with its work undone, which is the one
 * outcome a queue must never produce.
 */
export async function runNamedAction(action: string): Promise<unknown> {
  if (registered)
    return await registered(action)

  const actionsPackage = '@stacksjs/actions'
  const loaded = await import(actionsPackage).catch(() => null) as { runAction?: ActionRunner } | null

  if (loaded?.runAction) {
    // Cache it, so a worker pays the resolution once rather than per job.
    registered = loaded.runAction
    return await registered(action)
  }

  throw new Error(
    `Job names the action "${action}", but no action runner is available. `
    + `Import @stacksjs/actions in this process, or register one with `
    + `setActionRunner() from @stacksjs/queue.`,
  )
}
