/**
 * Every file that should be auto-importable appears in its barrel.
 *
 * `generated-declarations.test.ts` asks the opposite question - does each
 * DECLARED global exist at runtime - and it cannot see this one. When a new
 * `app/Jobs/*.ts` lands without `buddy generate`, the barrel and the
 * declarations go stale TOGETHER, so they agree with each other and every
 * existing check passes. Two stale files being consistent is exactly what made
 * this invisible (stacksjs/stacks#2408).
 *
 * This is the cheap half of that issue, deliberately. It does NOT make the
 * generated files reproducible: which entries get emitted depends on `feature()`
 * gates that read config that reads env, so "is this file current?" has no
 * single answer across environments - regenerating in CI, where `.env.keys` is
 * absent and 42 encrypted values fall back to defaults, produces a different
 * set than regenerating locally. A diff-against-regenerated check therefore
 * fails for reasons that are not staleness, which is why the attempt at one was
 * reverted (`e75835733b`).
 *
 * Asking only that nothing on disk is MISSING sidesteps that entirely: it is a
 * one-directional claim, true regardless of which environment generated the
 * file, and it catches the case that prompted the issue.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { path } from '@stacksjs/path'

/** Every `.ts` module under `dir`, excluding tests and declarations. */
function modulesIn(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  }
  catch {
    return [] // A directory an app has not created is not a failure.
  }

  return entries.flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      return modulesIn(full)
    return entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts') ? [full] : []
  })
}

/**
 * The basenames a barrel mentions.
 *
 * Matched on basename rather than full path on purpose: an app file overrides
 * a framework default of the same name, so `app/Actions/NotifyUser.ts` and
 * `defaults/app/Actions/NotifyUser.ts` are one entry, not two. Comparing paths
 * would report the shadowed default as missing when the override is exactly
 * what is supposed to happen.
 */
function namesIn(barrel: string): Set<string> {
  const source = readFileSync(barrel, 'utf-8')
  const names = new Set<string>()

  for (const [, ref] of source.matchAll(/'([^']*\/[^']+?)(?:\.ts)?'/g))
    names.add(ref.split('/').pop()!.replace(/\.ts$/, ''))

  return names
}

const BARRELS: Array<{ what: string, barrel: string, dirs: string[] }> = [
  {
    what: 'jobs',
    barrel: path.frameworkPath('auto-imports/jobs.ts'),
    dirs: [path.projectPath('app/Jobs'), path.frameworkPath('defaults/app/Jobs')],
  },
  {
    what: 'actions',
    barrel: path.frameworkPath('auto-imports/actions.ts'),
    dirs: [path.projectPath('app/Actions'), path.frameworkPath('defaults/app/Actions')],
  },
  {
    what: 'functions',
    barrel: path.frameworkPath('auto-imports/functions.ts'),
    dirs: [path.projectPath('resources/functions'), path.frameworkPath('defaults/functions')],
  },
]

describe('auto-import barrels list everything on disk', () => {
  for (const { what, barrel, dirs } of BARRELS) {
    it(`${what}: no module on disk is missing from the barrel`, () => {
      const listed = namesIn(barrel)

      const missing = dirs
        .flatMap(modulesIn)
        .map(file => file.split('/').pop()!.replace(/\.ts$/, ''))
        .filter(name => !listed.has(name))

      // A name here means someone added a file and did not run `buddy generate`,
      // so the framework will not auto-import it and nothing else would say so.
      expect([...new Set(missing)].sort()).toEqual([])
    })
  }
})
