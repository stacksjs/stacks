/**
 * stacksjs/stacks#2225 — `runJob` resolved job names only against the project's
 * own `app/Jobs/`, with no fallback to the framework defaults. Actions have
 * such a fallback, so a framework-shipped action could resolve by string and
 * then dispatch a framework-shipped job that could never be found.
 *
 * The default password-reset flow is exactly that shape:
 * `Actions/Password/SendPasswordResetEmailAction` resolves out of
 * `@stacksjs/defaults`, then calls `job('SendPasswordResetEmailJob')`. In a
 * stock app `app/Jobs/` holds a `.gitkeep`, so the dispatch threw and password
 * reset silently sent nothing.
 */

import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { appPath, frameworkPath } from '@stacksjs/path'
import { resolveJobFile } from '../src/job'

describe('resolveJobFile (#2225)', () => {
  it('finds a framework default job with no userland copy', async () => {
    // The exact job the shipped password-reset action dispatches. If this
    // stops resolving, that flow is silently broken again.
    const resolved = await resolveJobFile('SendPasswordResetEmailJob')

    expect(resolved).not.toBeNull()
    expect(existsSync(resolved!)).toBe(true)
    expect(resolved).toContain('defaults/app/Jobs/SendPasswordResetEmailJob.ts')
  })

  it('returns null for a job that exists nowhere', async () => {
    // Must be null rather than a non-existent path, so `runJob` can raise a
    // message naming every place it looked instead of a module-resolution error.
    expect(await resolveJobFile('__NoSuchJobAnywhere__')).toBeNull()
  })

  it('resolves the other shipped defaults too, not just one special case', async () => {
    for (const name of ['SendEmailJob', 'PruneQueryLogsJob', 'SyncSearchIndexJob']) {
      expect(await resolveJobFile(name)).not.toBeNull()
    }
  })

  describe('userland precedence', () => {
    // A framework default an app is allowed to override. Created and removed
    // here so the repo's own app/Jobs is left exactly as it was found.
    const OVERRIDE = 'SendPasswordResetEmailJob'
    const userCopy = appPath(`Jobs/${OVERRIDE}.ts`)
    const preexisting = existsSync(userCopy)

    afterAll(() => {
      if (!preexisting)
        rmSync(userCopy, { force: true })
    })

    it('prefers app/Jobs over the framework default of the same name', async () => {
      if (preexisting) {
        // Never clobber a real file; the assertion below still holds for it.
        expect(await resolveJobFile(OVERRIDE)).toBe(userCopy)
        return
      }

      mkdirSync(appPath('Jobs'), { recursive: true })
      writeFileSync(userCopy, 'export default { handle: async () => {} }\n')

      expect(await resolveJobFile(OVERRIDE)).toBe(userCopy)
      // ...and the framework copy it shadowed is genuinely there, so this is a
      // real precedence assertion rather than a "only one candidate existed" one.
      expect(existsSync(frameworkPath(`defaults/app/Jobs/${OVERRIDE}.ts`))).toBe(true)
    })
  })
})
