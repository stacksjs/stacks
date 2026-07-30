import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  readEnvironmentFile,
  updateEnvironmentFile,
  validateEnvironmentFile,
} from './environment-file'

async function fixture(): Promise<{ envPath: string, backupPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'stacks-dashboard-env-'))
  return {
    envPath: join(root, '.env'),
    backupPath: join(root, 'runtime', 'environment.backup'),
  }
}

describe('dashboard environment file', () => {
  test('validates syntax and duplicate keys without rejecting empty values', () => {
    expect(validateEnvironmentFile('APP_NAME=Stacks\nEMPTY=\n')).toEqual([])
    expect(validateEnvironmentFile('bad-key=value\nAPP_NAME=one\nAPP_NAME=two\n')).toEqual([
      { line: 1, message: 'Keys must use uppercase letters, numbers, and underscores.' },
      { line: 3, message: 'APP_NAME is already defined on line 2.' },
    ])
  })

  test('atomically writes the file and persists the previous content as its backup', async () => {
    const paths = await fixture()
    await writeFile(paths.envPath, 'APP_NAME=Before\n')
    const initial = await readEnvironmentFile(paths)

    const result = await updateEnvironmentFile('APP_NAME=After\n', initial.revision, paths)
    expect(result.issues).toBeUndefined()
    expect(result.conflict).toBeUndefined()
    expect(await readFile(paths.envPath, 'utf8')).toBe('APP_NAME=After\n')
    expect(await readFile(paths.backupPath, 'utf8')).toBe('APP_NAME=Before\n')
    expect((await stat(paths.envPath)).mode & 0o777).toBe(0o600)
    expect((await stat(paths.backupPath)).mode & 0o777).toBe(0o600)
    expect(result.state?.backup.content).toBe('APP_NAME=Before\n')
  })

  test('rejects stale revisions without modifying the file', async () => {
    const paths = await fixture()
    await writeFile(paths.envPath, 'APP_NAME=Current\n')

    const result = await updateEnvironmentFile('APP_NAME=Stale\n', '0'.repeat(64), paths)
    expect(result.conflict).toBe(true)
    expect(await readFile(paths.envPath, 'utf8')).toBe('APP_NAME=Current\n')
  })

  test('does not write invalid content', async () => {
    const paths = await fixture()
    await writeFile(paths.envPath, 'APP_NAME=Current\n')
    const current = await readEnvironmentFile(paths)

    const result = await updateEnvironmentFile('not valid', current.revision, paths)
    expect(result.issues).toEqual([{ line: 1, message: 'Expected KEY=value.' }])
    expect(await readFile(paths.envPath, 'utf8')).toBe('APP_NAME=Current\n')
  })
})
