import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nativePackageCatalog, renderDriverCapabilities, renderNativeCatalog } from '../src/commands/docs/native-skills'

const root = new URL('../../../../../', import.meta.url).pathname
const skillRoot = join(root, 'storage/framework/defaults/ai/skills')

describe('native skill discovery coverage', () => {
  it('covers every core package with a real skill and source pointer', () => {
    const packages = nativePackageCatalog()
    expect(packages.length).toBeGreaterThan(80)
    for (const entry of packages) {
      expect(existsSync(join(skillRoot, entry.skill, 'SKILL.md'))).toBe(true)
      expect(existsSync(join(root, entry.entry))).toBe(true)
      for (const path of [...entry.dependencies, ...entry.tests])
        expect(existsSync(join(root, path))).toBe(true)
    }
    expect(packages.find(entry => entry.name === '@stacksjs/forms')?.skill).toBe('stacks-forms')
    expect(packages.find(entry => entry.name === '@stacksjs/action-runner')?.skill).toBe('stacks-actions')
  })

  it('fails when a new package has no task guidance instead of silently omitting it', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'stacks-native-coverage-'))
    try {
      const packageRoot = join(fixture, 'storage/framework/core/new-native-package')
      mkdirSync(packageRoot, { recursive: true })
      writeFileSync(join(packageRoot, 'package.json'), '{"name":"@stacksjs/new-native-package"}')
      expect(() => nativePackageCatalog(fixture)).toThrow('needs a skill')
    }
    finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  /**
   * The catalog records a retained-test count per package, so adding or
   * removing ANY test file in a core package makes it stale.
   *
   * That is not obvious from anything: the count is a number in a table nobody
   * reads, the check that enforces it lives in this file, and the failure below
   * is a byte comparison of a 1500-line markdown file. Adding one test to
   * `core/database` therefore turns up as a multi-thousand-line diff in
   * `core/buddy`'s suite, with no indication that the fix is one command. It
   * cost a diagnosis cycle twice in one day (15d9f8f948 and dde735f115, both
   * followed by a catalog-only commit) before this existed.
   *
   * So this runs first and says which package drifted, in which direction, and
   * what to run. It is deliberately narrower than the comparison below rather
   * than a replacement for it: this one knows the common cause, and that one
   * catches everything else.
   */
  it('names the package whose retained-test count drifted, and the fix', () => {
    const catalog = readFileSync(join(skillRoot, 'stacks-native/CATALOG.md'), 'utf8')

    /** The count in the committed table row for `pkg`, or null when it has no row. */
    const committedCount = (pkg: string): number | null => {
      const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const row = new RegExp(`^\\| \`${escaped}\` \\|.*\\| (\\d+) \\|$`, 'm').exec(catalog)
      return row?.[1] === undefined ? null : Number(row[1])
    }

    const packages = nativePackageCatalog()

    // A package the generator knows and the committed table does not. The other
    // way a test-file change shows up: a brand-new package arrives with its
    // tests already written.
    const absent = packages.filter(entry => committedCount(entry.name) === null).map(entry => entry.name)
    expect(absent, 'missing from CATALOG.md; run `./buddy docs:native-skills`').toEqual([])

    const drifted = packages
      .map(entry => ({ name: entry.name, actual: entry.tests.length, committed: committedCount(entry.name) }))
      .filter(entry => entry.committed !== null && entry.committed !== entry.actual)
      .map(entry => `${entry.name}: CATALOG.md says ${entry.committed}, the package has ${entry.actual}`)

    expect(
      drifted,
      'a test file was added or removed in a core package, which changes its retained-test count. Run `./buddy docs:native-skills` and commit CATALOG.md with it',
    ).toEqual([])
  })

  it('keeps generated guidance current with real source exports and driver evidence', () => {
    expect(readFileSync(join(skillRoot, 'stacks-native/CATALOG.md'), 'utf8')).toBe(renderNativeCatalog())
    const drivers = renderDriverCapabilities()
    expect(readFileSync(join(skillRoot, 'stacks-native/CAPABILITIES.md'), 'utf8')).toBe(drivers)
    expect(drivers).toContain('## queue: sqs\n\nStatus: **unsupported**')
    expect(drivers).toContain('## storage: azure\n\nStatus: **partial**')
    expect(drivers).toContain('not a live container round trip')
  })
})
