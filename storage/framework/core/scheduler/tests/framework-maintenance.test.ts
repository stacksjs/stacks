import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { frameworkMaintenancePlan, scheduleFrameworkMaintenance, TOKEN_PRUNE_TASK } from '../src/maintenance'
import { Schedule } from '../src/schedule'

// stacksjs/stacks#3360. Auth tokens were never deleted unless the app
// scheduled `auth:prune` itself: one Postline user had 66 access and 66
// refresh tokens in the dev database. The scheduler now prunes them daily by
// default, and says so when a config still sets the dead `tokenRotation`.

afterEach(async () => {
  await Schedule.gracefulShutdown()
})

describe('the framework maintenance plan', () => {
  test('prunes tokens daily by default', () => {
    expect(frameworkMaintenancePlan({ auth: {}, isScheduled: () => false }).tasks).toEqual([TOKEN_PRUNE_TASK])
    expect(frameworkMaintenancePlan({ auth: undefined, isScheduled: () => false }).tasks).toEqual([TOKEN_PRUNE_TASK])
  })

  test('auth.pruneTokens: false turns it off', () => {
    expect(frameworkMaintenancePlan({ auth: { pruneTokens: false }, isScheduled: () => false }).tasks).toEqual([])
  })

  test('an app that schedules auth/prune itself keeps its own', () => {
    for (const name of ['auth/prune', 'Auth/Prune', 'AuthPrune'])
      expect(frameworkMaintenancePlan({ auth: {}, isScheduled: scheduled => scheduled === name }).tasks).toEqual([])
  })

  test('a config that still sets tokenRotation is told it does nothing', () => {
    const { warnings } = frameworkMaintenancePlan({ auth: { tokenRotation: 24 }, isScheduled: () => false })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('tokenRotation')
    expect(frameworkMaintenancePlan({ auth: {}, isScheduled: () => false }).warnings).toEqual([])
  })
})

test('the prune is registered with the scheduler, daily', async () => {
  scheduleFrameworkMaintenance({ auth: {} })
  // A schedule starts once its chain has settled, a microtask later.
  await Promise.resolve()
  expect(Schedule.isScheduled(TOKEN_PRUNE_TASK)).toBe(true)
  const job = Schedule.listJobs().find(entry => entry.name === TOKEN_PRUNE_TASK)
  expect(job?.pattern).toBe('15 3 * * *')
})

test('runScheduler applies it after the app has registered its own tasks', () => {
  const source = readFileSync(join(import.meta.dir, '../src/run.ts'), 'utf8')
  const appSchedule = source.indexOf('await runSchedulerInstance()')
  const maintenance = source.indexOf('scheduleFrameworkMaintenance(')
  expect(appSchedule).toBeGreaterThan(-1)
  expect(maintenance).toBeGreaterThan(appSchedule)
})
