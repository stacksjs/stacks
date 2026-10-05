import { afterAll, describe, expect, it } from 'bun:test'
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

const sourceFixture = join(import.meta.dir, '..', 'fixtures', 'component-dom')
const repositoryRoot = resolve(import.meta.dir, '../../../../..')
const scratch = mkdtempSync(join(tmpdir(), 'stacks-component-dom-'))

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

describe('very-happy-dom component testing', () => {
  it('runs the documented preload and DOM interaction', () => {
    const fixture = join(scratch, 'project')
    cpSync(sourceFixture, fixture, { recursive: true })
    mkdirSync(join(fixture, 'node_modules'), { recursive: true })
    cpSync(
      join(repositoryRoot, 'node_modules', 'very-happy-dom'),
      join(fixture, 'node_modules', 'very-happy-dom'),
      { recursive: true },
    )

    const result = Bun.spawnSync([
      process.execPath,
      'test',
      './tests/browser/checkout.test.ts',
    ], {
      cwd: fixture,
      stderr: 'pipe',
      stdout: 'pipe',
    })

    const output = `${result.stdout.toString()}${result.stderr.toString()}`
    if (result.exitCode !== 0)
      throw new Error(output)

    // The counts, not the `(pass) Checkout > ...` line: bun prints per-test
    // lines only when it believes it is in CI, so asserting on one passed in
    // CI and failed on every developer machine. One test, run and passed, is
    // the same claim without depending on the reporter.
    expect(output).toMatch(/\b1 pass\b/)
    expect(output).toMatch(/\b0 fail\b/)
    expect(output).toContain('Ran 1 test across 1 file')
    expect(result.exitCode).toBe(0)
  })
})
