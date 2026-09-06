import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderReport } from './report'
import { formatRuntimeRequirement, readRuntimeRequirement, runtimeMismatchWarning } from './runtime-version'

const root = mkdtempSync(join(tmpdir(), 'stacks-bench-runtime-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('benchmark runtime requirements', () => {
  test('detects an older runtime and preserves an exact project requirement', async () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ engines: { bun: '1.4.1' } }))
    expect(await readRuntimeRequirement(root, '1.3.14')).toEqual({ range: '1.4.1', matches: false })
    expect(await readRuntimeRequirement(root, '1.4.1')).toEqual({ range: '1.4.1', matches: true })
    expect(await readRuntimeRequirement(root, '1.4.2')).toEqual({ range: '1.4.1', matches: false })
  })

  test('honors version ranges instead of comparing version strings', async () => {
    const range = '^1.4.0 || ^1.3.14'
    writeFileSync(join(root, 'package.json'), JSON.stringify({ engines: { bun: range } }))
    expect(await readRuntimeRequirement(root, '1.4.2')).toEqual({ range, matches: true })
    expect(await readRuntimeRequirement(root, '1.2.0')).toEqual({ range, matches: false })
    expect(formatRuntimeRequirement({ range, matches: true })).toBe('^1.4.0 \\|\\| ^1.3.14 (matched)')
  })

  test('does not invent a requirement for a project without one', async () => {
    writeFileSync(join(root, 'package.json'), '{}')
    expect(await readRuntimeRequirement(root, '1.4.1')).toBeUndefined()
    expect(runtimeMismatchWarning(undefined, '1.4.1')).toBeUndefined()
    expect(runtimeMismatchWarning({ range: '^1.4.0', matches: true }, '1.4.1')).toBeUndefined()
  })

  test('keeps deliberate runtime comparisons visible in the report', () => {
    const report = renderReport({
      meta: {
        startedAt: '2026-09-05T00:00:00Z', driver: 'oha', publishable: true,
        connections: 50, warmupSeconds: 1, durationSeconds: 3, runs: 1,
        persistentQueryLogging: false,
        machine: { platform: 'darwin', release: 'test', cpu: 'test', cores: 1, bun: '1.3.14' },
        runtimeRequirement: { range: '1.4.1', matches: false },
      },
      scenarios: [], targets: [], measurements: [],
    })
    expect(report).toContain('| Bun | 1.3.14 |')
    expect(report).toContain('| Project Bun requirement | 1.4.1 (runtime mismatch) |')
    expect(report).toContain('| Persistent query history | disabled (production default) |')
    expect(report).toContain('Runtime mismatch: Bun 1.3.14 does not satisfy package.json engines.bun (1.4.1).')
  })
})
