import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diagnosePantryLock } from './diagnose-pantry-lock'

for (const exitCode of [0, 1]) {
  test(`retains the actual candidate and restores inputs when regeneration exits ${exitCode}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'pantry-lock-diagnostic-'))
    try {
      await writeFile(join(root, 'pantry.lock'), 'original lock\n')
      const fixture = join(root, 'installer.ts')
      await writeFile(fixture, `await Bun.write('pantry.lock', 'generated candidate\\n'); console.log('normal installer output'); process.exit(${exitCode})`)
      expect(await diagnosePantryLock(root, [process.execPath, fixture])).toBe(exitCode)
      expect(await readFile(join(root, 'pantry.lock'), 'utf8')).toBe('original lock\n')
      const output = join(root, 'artifacts/pantry-lock-diagnostic')
      expect(await readFile(join(output, 'committed.lock'), 'utf8')).toBe('original lock\n')
      expect(await readFile(join(output, 'candidate.lock'), 'utf8')).toBe('generated candidate\n')
      expect(await readFile(join(output, 'regeneration.stdout.log'), 'utf8')).toContain('normal installer output')
      expect(JSON.parse(await readFile(join(output, 'result.json'), 'utf8')).exitCode).toBe(exitCode)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}

test('restores the committed input even when the diagnostic installer cannot start', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pantry-lock-diagnostic-'))
  try {
    await writeFile(join(root, 'pantry.lock'), 'original lock\n')
    await expect(diagnosePantryLock(root, [join(root, 'missing-installer')])).rejects.toThrow()
    expect(await readFile(join(root, 'pantry.lock'), 'utf8')).toBe('original lock\n')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
