import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveTestSuiteFilters } from '../src/test/runner'

let project: string

/**
 * Whether the filesystem the fixture sits on tells `Browser` from `browser`.
 *
 * Asked of the fixture's own directory rather than read off the platform:
 * macOS's default volume ignores case, but a macOS volume can be
 * case-sensitive, and TMPDIR can point at one.
 */
let caseSensitive: boolean

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'stacks-test-suites-'))
  mkdirSync(join(project, 'tests', 'Browser'), { recursive: true })
  caseSensitive = !existsSync(join(project, 'tests', 'browser'))
  mkdirSync(join(project, 'tests', 'browser'), { recursive: true })
  mkdirSync(join(project, 'tests', 'unit'), { recursive: true })
  writeFileSync(join(project, 'tests', 'Browser', 'composer.test.ts'), '')
  writeFileSync(join(project, 'tests', 'browser', 'timeline.spec.ts'), '')
  writeFileSync(join(project, 'tests', 'unit', 'ignored.test.ts'), '')
})

afterAll(() => {
  rmSync(project, { recursive: true, force: true })
})

describe('test suite discovery', () => {
  it('discovers supported browser suite names without leaking other tests', () => {
    // Where `tests/browser` is `tests/Browser`, both files are in that one
    // directory, which the runner has to visit once, under the first name it
    // was given. Where they are two directories, as on CI's Linux runner,
    // each file is reported from its own.
    expect(resolveTestSuiteFilters(project, ['Browser', 'browser', 'ui']).sort()).toEqual(caseSensitive
      ? ['./tests/Browser/composer.test.ts', './tests/browser/timeline.spec.ts']
      : ['./tests/Browser/composer.test.ts', './tests/Browser/timeline.spec.ts'])
  })

  it('visits a directory once, whichever suite names reach it', () => {
    // On a case-sensitive filesystem the case above has no second name for a
    // directory, so a symlink provides one there and everywhere else.
    const aliased = mkdtempSync(join(tmpdir(), 'stacks-test-suites-'))
    try {
      mkdirSync(join(aliased, 'tests', 'Browser'), { recursive: true })
      writeFileSync(join(aliased, 'tests', 'Browser', 'composer.test.ts'), '')
      symlinkSync('Browser', join(aliased, 'tests', 'ui'))

      expect(resolveTestSuiteFilters(aliased, ['Browser', 'browser', 'ui'])).toEqual(['./tests/Browser/composer.test.ts'])
    }
    finally {
      rmSync(aliased, { recursive: true, force: true })
    }
  })

  it('returns no filters when a project has no matching UI suite', () => {
    expect(resolveTestSuiteFilters(project, ['ui'])).toEqual([])
  })
})
