import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveTestSuiteFilters } from './runner'

let project: string

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'stacks-test-suites-'))
  mkdirSync(join(project, 'tests', 'Browser'), { recursive: true })
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
    expect(resolveTestSuiteFilters(project, ['Browser', 'browser', 'ui']).sort()).toEqual([
      './tests/Browser/composer.test.ts',
      './tests/Browser/timeline.spec.ts',
    ])
  })

  it('returns no filters when a project has no matching UI suite', () => {
    expect(resolveTestSuiteFilters(project, ['ui'])).toEqual([])
  })
})
