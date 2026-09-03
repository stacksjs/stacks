/**
 * How a queued job runs an action it names by string.
 *
 * The port itself moved to `@stacksjs/action-runner` once the scheduler and
 * the DNS package turned out to need the same thing for the same reason. It
 * is re-exported here so `@stacksjs/queue`'s own API is unchanged.
 */

export type { ActionRunner } from '@stacksjs/action-runner'
export { getActionRunner, runNamedAction, setActionRunner } from '@stacksjs/action-runner'
