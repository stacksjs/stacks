/**
 * Framework-owned paths must not be resolved from the working directory.
 *
 * This bug class has been found four separate times, and each instance looked
 * different on the surface:
 *
 *   - `resolveDefaultsResources()` checked `existsSync('storage/framework/
 *     defaults/resources')`. From the framework root that finds the vendored
 *     copy; from anywhere else the check misses and the dev server silently
 *     serves the generated `core/defaults` copy instead of the source of truth.
 *   - Two `core/orm` suites scanned `resolve('storage/framework/defaults/app/
 *     Models')` and died on ENOENT when run from their own package — one of
 *     them the assertion guarding which models expose anonymous read APIs, so
 *     a security check had quietly not been running.
 *   - `Image` derived `root` from `process.cwd()` and `outputDir` from a bare
 *     `resolve('public/media/images')`, so passing a root wrote the
 *     derivatives somewhere else entirely.
 *
 * The distinction that matters:
 *
 *   - An **app-owned** path (`resources/`, `app/`, `config/`, `database/`) is
 *     relative to the project root, and for a running server the project root
 *     is the working directory. Those are fine.
 *   - A **framework-owned** path (`storage/framework/...`) is relative to
 *     wherever the framework is installed, which has nothing to do with where
 *     the process was started. Resolving one from the cwd is the bug.
 *
 * What makes it expensive is that the wrong answer is usually a real directory
 * with plausible contents, so nothing throws and nothing looks broken — it just
 * reads the wrong files. This scans for the shape rather than waiting for the
 * next symptom.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const frameworkRoot = resolve(import.meta.dir, '../../..')

/** Packages under `core/`, minus build output and vendored dependencies. */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'pantry')
      continue

    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      sourceFiles(path, found)
      continue
    }

    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
      found.push(path)
  }

  return found
}

/**
 * A call that hands a bare `storage/framework/...` string to something that
 * resolves it against the working directory.
 *
 * Deliberately narrow. It matches the literal-first form that every instance
 * so far has taken, and nothing else — a path built from a variable is beyond
 * a regex, and guessing at those would produce false positives in a check
 * whose whole value is that a failure means something.
 */
const CWD_RELATIVE_FRAMEWORK_PATH
  = /\b(?:existsSync|readFileSync|readdirSync|statSync|writeFileSync|mkdirSync|rmSync|resolve|Bun\.file|Bun\.write)\(\s*(['"`])storage\/framework\//

describe('framework-owned paths are not resolved from the working directory', () => {
  it('no source file resolves `storage/framework/...` against the cwd', () => {
    const offenders: string[] = []

    for (const file of sourceFiles(join(frameworkRoot, 'core'))) {
      const source = readFileSync(file, 'utf8')

      source.split('\n').forEach((line, index) => {
        // A mention inside a comment is documentation, including this file's.
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
        if (CWD_RELATIVE_FRAMEWORK_PATH.test(code))
          offenders.push(`${file.slice(frameworkRoot.length + 1)}:${index + 1}  ${line.trim()}`)
      })
    }

    expect(offenders).toEqual([])
  })

  it('the resolver that started this returns the same answer from any directory', () => {
    // Kept here as well as in its own suite: this is the canonical instance,
    // and the property is the one the whole rule is about.
    const previous = process.cwd()

    try {
      process.chdir(frameworkRoot)
      const fromRoot = require('../src/dev/defaults-resources').resolveDefaultsResources()

      process.chdir(import.meta.dir)
      const fromElsewhere = require('../src/dev/defaults-resources').resolveDefaultsResources()

      expect(fromElsewhere).toBe(fromRoot)
    }
    finally {
      process.chdir(previous)
    }
  })

  it('the framework root this test derives is really the framework root', () => {
    // Non-vacuity: if `frameworkRoot` were wrong, `sourceFiles` would scan an
    // empty tree and the first assertion would pass without reading anything.
    expect(statSync(join(frameworkRoot, 'core', 'orm', 'src')).isDirectory()).toBe(true)
    expect(sourceFiles(join(frameworkRoot, 'core')).length).toBeGreaterThan(500)
  })
})
