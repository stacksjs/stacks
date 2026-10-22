/**
 * Which test files `buddy test <path>` opens.
 *
 * `test`, `test:unit` and `test:feature` used to accept positional paths,
 * discard them and run the whole suite. That made the discarded input produce
 * a false green: naming a file with 20 failures printed `0 fail` and exited 0,
 * because the file was never among the 103 the command actually ran
 * (stacksjs/stacks#2973).
 *
 * So the two things under test are that a named path decides the file set, and
 * that a path matching no test file is refused. A fallback to the whole suite
 * is what turns a typo into a passing run.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { namedTestPaths, resolveNamedTestFiles, withinSuite } from '../src/test/runner'

let project: string

function write(relative: string): void {
  const full = join(project, relative)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, 'import { test } from "bun:test"\ntest("x", () => {})\n')
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'test-paths-'))
  write('tests/unit/auth.test.ts')
  write('tests/unit/nested/deep.test.ts')
  write('tests/feature/login.test.ts')
  write('packages/widget/tests/widget.spec.ts')
  write('packages/widget/src/index.ts')
})

afterEach(() => {
  rmSync(project, { recursive: true, force: true })
})

describe('resolveNamedTestFiles', () => {
  // The `./` prefix is the point: bunfig sets `[test] root = "tests"`, so a
  // bare project-relative path matches nothing and `bun test` reports a clean
  // run over no files at all.
  test('a named file resolves to a ./-prefixed project-relative path', () => {
    expect(resolveNamedTestFiles(project, ['tests/unit/auth.test.ts'])).toEqual(['./tests/unit/auth.test.ts'])
  })

  test('a named directory covers the test files under it, recursively', () => {
    expect(resolveNamedTestFiles(project, ['tests/unit'])).toEqual([
      './tests/unit/auth.test.ts',
      './tests/unit/nested/deep.test.ts',
    ])
  })

  test('a test file outside tests/ is reachable, which is the whole gap', () => {
    expect(resolveNamedTestFiles(project, ['packages/widget'])).toEqual(['./packages/widget/tests/widget.spec.ts'])
  })

  test('several paths union, and a file named twice appears once', () => {
    expect(resolveNamedTestFiles(project, ['tests/feature', 'tests/unit/auth.test.ts', 'tests/feature/login.test.ts'])).toEqual([
      './tests/feature/login.test.ts',
      './tests/unit/auth.test.ts',
    ])
  })

  test('an absolute path inside the project is accepted', () => {
    expect(resolveNamedTestFiles(project, [join(project, 'tests/unit/auth.test.ts')])).toEqual(['./tests/unit/auth.test.ts'])
  })

  describe('a path matching no test file is refused, never widened', () => {
    test('a path that does not exist', () => {
      expect(() => resolveNamedTestFiles(project, ['tests/unit/nope.test.ts'])).toThrow(/no such file or directory/)
    })

    test('a real file that is not a test', () => {
      expect(() => resolveNamedTestFiles(project, ['packages/widget/src/index.ts'])).toThrow(/a test file is named/)
    })

    test('a directory holding no tests', () => {
      expect(() => resolveNamedTestFiles(project, ['packages/widget/src'])).toThrow(/holds no test files/)
    })

    test('a path outside the project', () => {
      expect(() => resolveNamedTestFiles(project, ['../elsewhere'])).toThrow(/outside the project/)
    })

    test('one bad path refuses the whole call', () => {
      expect(() => resolveNamedTestFiles(project, ['tests/unit', 'tests/unit/nope.test.ts'])).toThrow(/no such file or directory/)
    })
  })
})

describe('withinSuite', () => {
  const files = ['./tests/feature/login.test.ts', './tests/unit/auth.test.ts']

  test('narrows to the suite the command names', () => {
    expect(withinSuite(files, 'unit', ['tests'])).toEqual(['./tests/unit/auth.test.ts'])
    expect(withinSuite(files, 'feature', ['tests'])).toEqual(['./tests/feature/login.test.ts'])
  })

  // An empty intersection reported as a pass is the original bug in miniature.
  test('a path with no tests in that suite points at the command that runs it', () => {
    expect(() => withinSuite(['./packages/widget/tests/widget.spec.ts'], 'unit', ['packages/widget']))
      .toThrow(/No unit tests under packages\/widget\. Run `buddy test packages\/widget`/)
  })
})

describe('namedTestPaths', () => {
  const key = 'STACKS_TEST_PATHS'
  const original = process.env[key]

  afterEach(() => {
    if (original === undefined)
      delete process.env[key]
    else process.env[key] = original
  })

  test('reads the JSON array the command sets', () => {
    process.env[key] = JSON.stringify(['tests/unit', 'a,b/with-comma.test.ts'])
    expect(namedTestPaths()).toEqual(['tests/unit', 'a,b/with-comma.test.ts'])
  })

  test('no paths named means no paths, so the suite runs as before', () => {
    delete process.env[key]
    expect(namedTestPaths()).toEqual([])
  })

  // Reading nothing has to mean "run the suite", not "run no tests at all".
  test('unparseable or wrongly shaped input reads as no paths', () => {
    process.env[key] = 'not json'
    expect(namedTestPaths()).toEqual([])
    process.env[key] = '{"paths":["a"]}'
    expect(namedTestPaths()).toEqual([])
    process.env[key] = '[1, null, "tests/unit"]'
    expect(namedTestPaths()).toEqual(['tests/unit'])
  })
})
