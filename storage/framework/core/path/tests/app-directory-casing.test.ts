/**
 * The `app/` helpers name real directories, in the casing they really have.
 *
 * `modelsPath` built `app/models`. Every other `appPath`-relative helper uses
 * the capitalized directory name, and `app/Models` is what is on disk - but a
 * case-insensitive filesystem resolves the lowercase form happily, so the bug
 * was invisible on macOS and Windows and returned a path to nothing on Linux,
 * which is where CI and every deployed server runs.
 *
 * A test that only calls `existsSync` reproduces that blind spot exactly. This
 * one compares the segment against the directory listing instead, so it fails
 * on the machine the mistake gets made on.
 */

import { readdirSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { describe, expect, it } from 'bun:test'
import {
  actionsPath,
  commandsPath,
  jobsPath,
  listenersPath,
  modelsPath,
  notificationsPath,
  userControllersPath,
  userJobsPath,
  userListenersPath,
  userMailPath,
  userMiddlewarePath,
  userModelsPath,
  userNotificationsPath,
} from '../src/index'

/**
 * The canonical casing, from the defaults tree - the one `app/` directory that
 * is always populated, and the template every scaffolded project is laid down
 * from.
 */
const DEFAULTS_APP = 'storage/framework/defaults/app'
const canonical = new Map(
  readdirSync(DEFAULTS_APP, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => [entry.name.toLowerCase(), entry.name]),
)

/**
 * Helpers that resolve into `app/`, with the directory each one claims.
 *
 * `notificationsPath` is deliberately absent: it names the `@stacksjs/
 * notifications` package, not `app/Notifications`. `userNotificationsPath` is
 * the one that resolves into `app/`.
 */
const appHelpers: Array<[string, (p?: string) => string]> = [
  ['actionsPath', actionsPath],
  ['commandsPath', commandsPath],
  ['jobsPath', jobsPath],
  ['listenersPath', listenersPath],
  ['modelsPath', modelsPath],
  ['userControllersPath', userControllersPath],
  ['userJobsPath', userJobsPath],
  ['userListenersPath', userListenersPath],
  ['userMailPath', userMailPath],
  ['userMiddlewarePath', userMiddlewarePath],
  ['userModelsPath', userModelsPath],
  ['userNotificationsPath', userNotificationsPath],
]

describe('app directory helpers', () => {
  it('names each directory in the casing it actually has', () => {
    const wrong: Record<string, string> = {}

    for (const [name, helper] of appHelpers) {
      const resolved = helper()
      // `helper()` ends in a trailing slash, so the directory name is the
      // basename of the path with that slash removed.
      const segment = basename(resolved.replace(/\/$/, ''))
      if (dirname(resolved.replace(/\/$/, '')).split('/').pop() !== 'app') continue

      const expected = canonical.get(segment.toLowerCase())
      if (expected && expected !== segment)
        wrong[name] = `resolves '${segment}', directory is '${expected}'`
    }

    expect(wrong).toEqual({})
  })

  it('keeps modelsPath and userModelsPath pointing at one directory', () => {
    // They disagreed on the casing of the same directory. Now one delegates to
    // the other, and this says so.
    expect(modelsPath()).toBe(userModelsPath())
    expect(modelsPath('User.ts')).toBe(userModelsPath('User.ts'))
    expect(modelsPath('User.ts').endsWith('app/Models/User.ts')).toBe(true)
  })

  it('does not confuse notificationsPath with the app directory', () => {
    // One names the package, the other the app directory. Guarded because the
    // names are one word apart and the test above skips anything not under `app/`.
    expect(notificationsPath()).toContain('core/notifications')
    expect(userNotificationsPath()).toContain('app/Notifications')
  })
})
