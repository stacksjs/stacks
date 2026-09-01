/**
 * The app typecheck must not run on an incremental cache.
 *
 * `tsc`'s incremental state goes stale across the regeneration of the
 * auto-import barrels, in the direction that matters: after removing a job and
 * running `buddy generate`, a warm cache reported ZERO errors on an app whose
 * `Scheduler.ts` still scheduled the deleted job — the exact diagnostic
 * `SchedulableJobs` exists to produce. Cold, the same tree reports it. Neither
 * half does it alone: the deleted file is noticed, the edited barrel is
 * noticed; only the combination loses the diagnostic.
 *
 * Measured before turning it off: cold 3.3s, warm 1.9s, and through
 * `buddy typecheck` the difference is inside the noise of CLI boot. A second
 * and a half is not worth a check that can pass on code that does not compile.
 *
 * This is a decision, not an implementation detail, which is why it is pinned:
 * `incremental: true` is the kind of thing that gets added back for the speed
 * without the reason being visible.
 *
 * stacksjs/stacks#2405.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

/**
 * tsconfig files are JSONC: comments and trailing commas, neither of which
 * `JSON.parse` accepts.
 *
 * Stripped with a scanner rather than a regex because these files are full of
 * prose that contains `//` (URLs, `https://`, path globs) and `/*` inside
 * string values — a regex over the whole text mangles those and the parse then
 * fails somewhere unrelated to the comment it was trying to remove.
 */
function readTsConfig(relativePath: string): Record<string, any> {
  const raw = readFileSync(join(root, relativePath), 'utf8')
  let out = ''
  let inString = false

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]

    if (inString) {
      out += char
      if (char === '\\') {
        out += raw[++i] ?? ''
        continue
      }
      if (char === '"')
        inString = false
      continue
    }

    if (char === '"') {
      inString = true
      out += char
      continue
    }

    if (char === '/' && raw[i + 1] === '/') {
      while (i < raw.length && raw[i] !== '\n') i++
      out += '\n'
      continue
    }

    if (char === '/' && raw[i + 1] === '*') {
      i += 2
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) i++
      i++
      continue
    }

    out += char
  }

  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

/** The app config chain, nearest first. */
const APP_CHAIN = ['tsconfig.json', 'storage/framework/tsconfig.app.json']

describe('app typecheck cache', () => {
  it('does not enable incremental anywhere in the app config chain', () => {
    // The nearest config that mentions it wins, so a `true` anywhere above the
    // `false` would restore the false green.
    const settings = APP_CHAIN
      .map(path => ({ path, incremental: readTsConfig(path).compilerOptions?.incremental }))
      .filter(entry => entry.incremental !== undefined)

    expect(settings.length).toBeGreaterThan(0)
    expect(settings[0]).toEqual({ path: 'storage/framework/tsconfig.app.json', incremental: false })
    expect(settings.every(entry => entry.incremental === false)).toBe(true)
  })

  it('turns it off for an installed app too, not just a vendored checkout', () => {
    // `tsconfig.package-app.json` is what an app extends when Stacks comes from
    // npm. It had the same persisted build-info file and therefore the same bug.
    expect(readTsConfig('storage/framework/tsconfig.package-app.json').compilerOptions?.incremental).toBe(false)
  })

  it('writes no build-info file for the app project', () => {
    for (const path of [...APP_CHAIN, 'storage/framework/tsconfig.package-app.json'])
      expect(readTsConfig(path).compilerOptions?.tsBuildInfoFile).toBeUndefined()
  })

  it('leaves the framework projects on the cache, where it earns its keep', () => {
    // Not an oversight: those projects are much larger, and
    // `generateAutoImportFiles()` drops their build-info files when it rewrites
    // a barrel, which is the trigger this issue identified.
    expect(readTsConfig('storage/framework/tsconfig.framework.json').compilerOptions?.tsBuildInfoFile).toBeTruthy()
    expect(readTsConfig('storage/framework/tsconfig.defaults.json').compilerOptions?.tsBuildInfoFile).toBeTruthy()
  })

  it('has generation invalidate the caches those projects keep', () => {
    const source = readFileSync(join(root, 'storage/framework/core/server/src/imports.ts'), 'utf8')

    expect(source).toContain('invalidateTypeScriptBuildInfo')
    expect(source).toContain('.tsbuildinfo')
  })
})
