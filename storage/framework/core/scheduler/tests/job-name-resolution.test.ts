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
    expect(runner).toContain('const jobName = getJobName(jobFile)')
    expect(runner).not.toContain('snakeCase(getJobName')
  })

  it('does not reach for a case-folding helper at all', () => {
    for (const transform of ['snakeCase', 'kebabCase', 'camelCase', 'toLowerCase()'])
      expect(runner).not.toContain(transform)
  })

  it('is the file name, which is what has to be found on disk', () => {
    // Not the config's `name`: that is a label, and scheduling under it left
    // a Scheduler.ts entry for the file name unrecognised. `runJob` finds a
    // job by either.
    expect(runner).toContain("baseName.replace(/\\.ts$/, '')")
    expect(runner).not.toContain('if (job.name)\n    return job.name')
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

  it('finds a job by the name it declares, when no file is called that', async () => {
    /*
     * The scaffold's ExampleJob.ts declares `name: 'Example Job'`, and a
     * `new Job({...}).dispatch()` writes that name into the envelope. The
     * worker looked for `Example Job.ts` and failed every run.
     */
    const { jobDefaults, resolveJobFile } = await import('../../queue/src/job')

    expect(await resolveJobFile('Example Job')).toEndWith('/app/Jobs/ExampleJob.ts')
    expect(await jobDefaults('Example Job')).toMatchObject({ tries: 3, backoff: 3 })
  })

  it('still prefers a file of that name, and still finds nothing for a name nobody has', async () => {
    const { resolveJobFile } = await import('../../queue/src/job')

    expect(await resolveJobFile('ExampleJob')).toEndWith('/app/Jobs/ExampleJob.ts')
    expect(await resolveJobFile('SendEmail')).toEndWith('/app/Jobs/SendEmailJob.ts')
    expect(await resolveJobFile('No Such Job')).toBeNull()
  })
})
