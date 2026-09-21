import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSourceSnapshot } from './provenance'

const temporaryDirectories: string[] = []

function git(directory: string, ...args: string[]): void {
  const result = Bun.spawnSync(['git', ...args], { cwd: directory })
  if (result.exitCode !== 0)
    throw new Error(result.stderr.toString())
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('startup benchmark source provenance', () => {
  test('changes its fingerprint for tracked and untracked content', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-startup-source-'))
    temporaryDirectories.push(directory)
    git(directory, 'init', '--quiet')
    git(directory, 'config', 'user.email', 'benchmark@example.test')
    git(directory, 'config', 'user.name', 'Benchmark Test')
    writeFileSync(join(directory, 'tracked.ts'), 'export const value = 1\n')
    git(directory, 'add', 'tracked.ts')
    git(directory, 'commit', '--quiet', '-m', 'test: create fixture')

    const clean = await readSourceSnapshot(directory)
    expect(clean.dirty).toBeFalse()
    writeFileSync(join(directory, 'tracked.ts'), 'export const value = 2\n')
    const tracked = await readSourceSnapshot(directory)
    expect(tracked.dirty).toBeTrue()
    expect(tracked.fingerprint).not.toBe(clean.fingerprint)

    writeFileSync(join(directory, 'untracked.ts'), 'export const extra = 1\n')
    const firstUntracked = await readSourceSnapshot(directory)
    writeFileSync(join(directory, 'untracked.ts'), 'export const extra = 2\n')
    const secondUntracked = await readSourceSnapshot(directory)
    expect(secondUntracked.fingerprint).not.toBe(firstUntracked.fingerprint)
  })
})
