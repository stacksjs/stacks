import type { SchedulableActionName } from './schedule'
import { log } from '@stacksjs/logging'
import { Schedule } from './schedule'

/**
 * Housekeeping the framework schedules for every app, beside whatever
 * app/Scheduler.ts declares.
 *
 * Auth tokens were never deleted unless the app scheduled `auth:prune`
 * itself, which nothing told it to do: one Postline user had 66 access and 66
 * refresh tokens in the dev database (stacksjs/stacks#3360). Expired tokens,
 * and revoked ones older than 7 days, are now pruned daily.
 */
export const TOKEN_PRUNE_TASK = 'auth/prune'

/** Names an app may have scheduled the same prune under itself. */
const TOKEN_PRUNE_ALIASES = [TOKEN_PRUNE_TASK, 'Auth/Prune', 'AuthPrune']

/** When the daily prune runs, in the app's timezone: off-peak, and away from midnight's rush of other jobs. */
const TOKEN_PRUNE_TIME = '03:15'

interface MaintenanceAuthConfig {
  /** `false` stops the framework pruning tokens. Default `true`. */
  pruneTokens?: boolean
  /** Deprecated and read by nothing; set only to be warned about. */
  tokenRotation?: number
}

/**
 * What the framework schedules for an app: the tasks, and the warnings to
 * print about its config. Pure, so the decision can be tested apart from the
 * scheduler.
 */
export function frameworkMaintenancePlan(input: { auth: MaintenanceAuthConfig | undefined, isScheduled: (name: string) => boolean }): { tasks: string[], warnings: string[] } {
  const auth = input.auth ?? {}
  const tasks: string[] = []
  if (auth.pruneTokens !== false && !TOKEN_PRUNE_ALIASES.some(name => input.isScheduled(name)))
    tasks.push(TOKEN_PRUNE_TASK)

  const warnings: string[] = []
  if (auth.tokenRotation !== undefined) {
    warnings.push('[scheduler] config/auth.ts sets `tokenRotation`, which nothing reads: a token is never rotated automatically, because a rotation could not hand the new bearer back to its client. Remove it, and rotate with `Auth.rotateToken()` or a refresh-token exchange.')
  }
  return { tasks, warnings }
}

/**
 * Register the framework's housekeeping with the scheduler. Called by
 * `runScheduler()` after the app has registered its own tasks, so an app that
 * schedules `auth/prune` itself keeps its own timing.
 */
export function scheduleFrameworkMaintenance(config: { auth?: MaintenanceAuthConfig }): void {
  const plan = frameworkMaintenancePlan({ auth: config.auth, isScheduled: name => Schedule.isScheduled(name) })
  for (const warning of plan.warnings)
    log.warn(warning)
  if (plan.tasks.includes(TOKEN_PRUNE_TASK))
    Schedule.action(TOKEN_PRUNE_TASK as SchedulableActionName).dailyAt(TOKEN_PRUNE_TIME)
}
