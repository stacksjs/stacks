import { afterEach, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptEnv, getEnv, setEnv } from '../src/cli'

const directories: string[] = []
function project(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-env-private-'))
  directories.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

test.skipIf(process.platform === 'win32')('env:set bootstrap keeps its private key owner-only', () => {
  const cwd = project()
  expect(setEnv('FIXTURE_SECRET', 'bootstrap-fixture', { cwd, file: '.env.production' }).success).toBe(true)
  expect(statSync(join(cwd, '.env.keys')).mode & 0o777).toBe(0o600)
  expect(getEnv('FIXTURE_SECRET', { cwd, file: '.env.production' }).output).toBe('bootstrap-fixture')
})

test.skipIf(process.platform === 'win32')('env:encrypt bootstrap keeps its private key owner-only', () => {
  const cwd = project()
  writeFileSync(join(cwd, '.env.production'), 'FIXTURE_SECRET=encrypt-fixture\n')
  expect(encryptEnv({ cwd, file: '.env.production' }).success).toBe(true)
  expect(statSync(join(cwd, '.env.keys')).mode & 0o777).toBe(0o600)
  expect(getEnv('FIXTURE_SECRET', { cwd, file: '.env.production' }).output).toBe('encrypt-fixture')
})

test.skipIf(process.platform === 'win32').each(['set', 'encrypt'] as const)('%s appends production keys atomically while preserving unrelated content', (operation) => {
  const cwd = project()
  expect(setEnv('STAGING_FIXTURE', 'staging-value', { cwd, file: '.env.staging' }).success).toBe(true)
  const path = join(cwd, '.env.keys')
  const original = `# Keep this unrelated note\n${readFileSync(path, 'utf8')}`
  writeFileSync(path, original)
  chmodSync(path, 0o644)
  const originalInode = statSync(path).ino
  writeFileSync(join(cwd, '.env.production'), 'FIXTURE_SECRET=production-value\n')
  const result = operation === 'set'
    ? setEnv('FIXTURE_SECRET', 'production-value', { cwd, file: '.env.production' })
    : encryptEnv({ cwd, file: '.env.production' })
  expect(result.success).toBe(true)
  expect(statSync(path).mode & 0o777).toBe(0o600)
  expect(statSync(path).ino).not.toBe(originalInode)
  expect(readFileSync(path, 'utf8')).toStartWith(original)
  expect(getEnv('STAGING_FIXTURE', { cwd, file: '.env.staging' }).output).toBe('staging-value')
  expect(getEnv('FIXTURE_SECRET', { cwd, file: '.env.production' }).output).toBe('production-value')
  expect(readdirSync(cwd).filter(name => name.endsWith('.tmp'))).toEqual([])
})

test.skipIf(process.platform === 'win32').each(['set', 'encrypt'] as const)('%s hardens reused keys without replacing their values or comments', (operation) => {
  const cwd = project()
  const options = { cwd, file: '.env.production', keysFile: 'custom.keys' }
  expect(setEnv('FIXTURE_SECRET', 'original-value', options).success).toBe(true)
  const path = join(cwd, 'custom.keys')
  const original = `# Keep this existing key generation\n${readFileSync(path, 'utf8')}`
  writeFileSync(path, original)
  chmodSync(path, 0o644)
  const result = operation === 'set' ? setEnv('NEXT_FIXTURE', 'next-value', options) : encryptEnv(options)
  expect(result.success).toBe(true)
  expect(statSync(path).mode & 0o777).toBe(0o600)
  expect(readFileSync(path, 'utf8')).toBe(original)
  expect(getEnv('FIXTURE_SECRET', options).output).toBe('original-value')
})
