import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Whether `buddy dev` runs the scheduler beside its servers (stacksjs/stacks#3366).
 *
 * It used to start the frontend, API and docs and never the scheduler, so
 * scheduled work did not happen during local use at all: a post scheduled a
 * minute ahead never went out, with nothing to say a second command was
 * needed. It is on by default; `--no-schedule` or `STACKS_DEV_SCHEDULE=0`
 * turns it off, for an app whose tasks send or post for real.
 *
 * An app with nothing to schedule starts nothing.
 */
export function devSchedulerEnabled(input: { flag?: boolean, env?: string, hasScheduledWork: boolean }): boolean {
  if (input.flag === false)
    return false
  if (input.env !== undefined && ['0', 'false', 'off', 'no'].includes(input.env.trim().toLowerCase()))
    return false
  return input.hasScheduledWork
}

/**
 * Whether the app declares anything the scheduler would run: an
 * `app/Scheduler.ts`, or a job in `app/Jobs/` (a job's `rate` schedules it).
 */
export function hasScheduledWork(root: string): boolean {
  if (existsSync(join(root, 'app', 'Scheduler.ts')))
    return true
  try {
    return readdirSync(join(root, 'app', 'Jobs')).some(file => file.endsWith('.ts'))
  }
  catch {
    return false
  }
}
