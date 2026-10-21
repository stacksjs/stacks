import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { defaultsPath, frameworkPath } from '../src/index'

/**
 * The subpaths the framework reads out of the defaults tree.
 *
 * Phase 3 of stacksjs/stacks#2941 moved the call sites that read these from
 * `frameworkPath('defaults/...')` onto `defaultsPath(...)`. In this checkout
 * both produce the same string, which is what makes the conversion safe to
 * land - and also what makes a typecheck green worth nothing here, because a
 * subpath is a string and dropping a segment from one compiles perfectly.
 *
 * So each one is checked against the filesystem. A conversion that lost the
 * `app/` prefix, or wrote `Model` for `Models`, resolves to a path that is not
 * there and fails naming it.
 */
const READ_BY_THE_FRAMEWORK = [
  // The `app/` override chain: userland first, these second.
  'app/Models',
  'app/Actions',
  'app/Controllers',
  'app/Middleware',
  'app/Jobs',
  'app/Policies',
  // The dashboard, which reads views, components and functions by path.
  'views/dashboard',
  'views/system-tray',
  'resources/components',
  'resources/components/Dashboard',
  'resources/functions',
  'resources/functions/dashboard/toggles.ts',
  'resources/functions/dashboard/config-io.ts',
  'resources/assets/images/app-icon.png',
  // Routes `bootstrap.ts` registers when a feature mounts.
  'routes',
  // Templates `buddy new` lays over a fresh app. `scaffold/` is the directory
  // that was missing from every published tarball until ef2fcc07df.
  'scaffold/config',
  'scaffold/resources',
  'vcs/github',
]

describe('the defaults subpaths the framework reads', () => {
  it.each(READ_BY_THE_FRAMEWORK)('%s resolves to something that exists', (sub) => {
    expect(existsSync(defaultsPath(sub))).toBe(true)
  })

  it('resolves identically to the path it replaced, in a vendored checkout', () => {
    // The conversion is a no-op here by construction. Asserted rather than
    // assumed, because every call site was edited by hand.
    for (const sub of READ_BY_THE_FRAMEWORK)
      expect(defaultsPath(sub)).toBe(frameworkPath(`defaults/${sub}`))
  })
})
