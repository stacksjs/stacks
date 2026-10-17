import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveDeployEnvValues } from '../src/commands/deploy'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})
function file(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-deploy-completeness-'))
  directories.push(directory)
  return join(directory, '.env.production')
}

describe('deployment environment completeness', () => {
  test('refuses a file whose encrypted entries cannot be resolved', async () => {
    const path = file()
    writeFileSync(path, 'BLOB_LOCAL_ROOT=/srv/shared/blobs\nPRIVATE_VALUE="encrypted:v2:controlled-unreadable-ciphertext"\n')
    await expect(resolveDeployEnvValues('production', { project: { slug: 'fixture' } }, path)).rejects.toThrow('Cannot load deployment environment')
  })

  test('refuses an existing unreadable environment instead of deploying an empty map', async () => {
    const path = file()
    mkdirSync(path)
    await expect(resolveDeployEnvValues('production', undefined, path)).rejects.toThrow('Cannot load deployment environment')
  })

  test('retains a complete readable custom runtime setting', async () => {
    const path = file()
    writeFileSync(path, 'BLOB_LOCAL_ROOT=/srv/shared/blobs\n')
    expect(await resolveDeployEnvValues('production', { project: { slug: 'fixture' } }, path)).toEqual({ BLOB_LOCAL_ROOT: '/srv/shared/blobs' })
  })
})
