/**
 * The name a rate-scheduled job is dispatched under.
 *
 * A job that declares `rate: Every.Hour` is scheduled automatically by the
 * runner, which read its name and snake-cased it before handing it to
 * `schedule.job(...)`. `runJob` resolves that name back to a FILE —
 * `app/Jobs/<name>.ts` — so `Inspire` became a lookup for `inspire.ts`.
 *
 * macOS hides this completely: its filesystem is case-insensitive, so
 * `Bun.file('app/Jobs/inspire.ts').exists()` is true next to `Inspire.ts`, and
 * every developer machine runs the job fine. Linux does not, so every
 * rate-scheduled job in every deployed app failed — once an hour, forever, in a
 * log line nobody reads. Found in a dispensary's production journal:
 *
 *   Job inspire not found. Looked in app/Jobs/inspire.ts and the framework
 *   defaults (storage/framework/defaults/app/Jobs, @stacksjs/defaults).
 *
 * beside an `app/Jobs/Inspire.ts` that had been there all along.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const runner = readFileSync(join(import.meta.dir, '../src/run.ts'), 'utf8')

describe('the job name the runner schedules', () => {
  it('is not transformed on its way to the scheduler', () => {
    // The specific transform that broke it. Any case-folding here reintroduces
    // a bug that is invisible on the machine it is written on.
    expect(runner).toContain('const jobName = getJobName(job, jobFile)')
    expect(runner).not.toContain('snakeCase(getJobName')
  })

  it('does not reach for a case-folding helper at all', () => {
    for (const transform of ['snakeCase', 'kebabCase', 'camelCase', 'toLowerCase()'])
      expect(runner).not.toContain(transform)
  })

  it('falls back to the file name, which is what has to be found on disk', () => {
    // `getJobName` prefers the config's `name`; without one the file name is
    // both the name and the thing `runJob` opens.
    expect(runner).toContain("baseName.replace(/\\.ts$/, '')")
  })
})

describe('resolving a job to a file', () => {
  it('looks for the name exactly as given', async () => {
    const { resolveJobFile } = await import('../../queue/src/job')
    const resolved = await resolveJobFile('DefinitelyNotAJobThatExists')

    expect(resolved).toBeNull()
  })

  it('finds a framework default by its real, capitalised name', async () => {
    /*
     * The end-to-end shape of the bug, on the one job every scaffold ships.
     * Asserted against a file the framework itself provides so this does not
     * depend on the checkout having an app.
     */
    const { resolveJobFile } = await import('../../queue/src/job')

    expect(await resolveJobFile('ExampleJob')).toContain('ExampleJob.ts')
  })
})
