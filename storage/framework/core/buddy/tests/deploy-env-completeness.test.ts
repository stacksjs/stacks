import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deployEnvFailureDetail, resolveDeployEnvValues } from '../src/commands/deploy'

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

  test('names the encrypted keys and the private key it looked for, never a value', async () => {
    const path = file()
    const previous = process.env.DOTENV_PRIVATE_KEY_PRODUCTION
    delete process.env.DOTENV_PRIVATE_KEY_PRODUCTION
    writeFileSync(path, 'DOTENV_PUBLIC_KEY_PRODUCTION="x25519-public:AAAA"\nAPPLE_KEY_ID="encrypted:v2:secret-ciphertext"\nBLOB_LOCAL_ROOT=/srv/shared/blobs\n')
    try {
      const error = await resolveDeployEnvValues('production', { project: { slug: 'fixture' } }, path).catch((e: Error) => e)
      expect(error).toBeInstanceOf(Error)
      const message = (error as Error).message
      expect(message).toContain('Encrypted in')
      expect(message).toContain('APPLE_KEY_ID')
      expect(message).toContain('DOTENV_PRIVATE_KEY_PRODUCTION is not set')
      expect(message).not.toContain('secret-ciphertext')
      expect(message).not.toContain('BLOB_LOCAL_ROOT')
    }
    finally {
      if (previous !== undefined)
        process.env.DOTENV_PRIVATE_KEY_PRODUCTION = previous
    }
  })

  test('says a set private key does not match, without echoing it', () => {
    const path = file()
    writeFileSync(path, 'DOTENV_PUBLIC_KEY_PRODUCTION="x25519-public:AAAA"\nTOKEN=encrypted:v2:abc\n')
    const previous = process.env.DOTENV_PRIVATE_KEY_PRODUCTION
    process.env.DOTENV_PRIVATE_KEY_PRODUCTION = 'x25519-private:not-the-one'
    try {
      const detail = deployEnvFailureDetail(path, '.env.production')
      expect(detail).toContain('TOKEN')
      expect(detail).toContain('is set but does not decrypt them')
      expect(detail).not.toContain('not-the-one')
    }
    finally {
      if (previous === undefined)
        delete process.env.DOTENV_PRIVATE_KEY_PRODUCTION
      else process.env.DOTENV_PRIVATE_KEY_PRODUCTION = previous
    }
  })

  test('adds nothing when the file holds no ciphertext', () => {
    const path = file()
    writeFileSync(path, 'BLOB_LOCAL_ROOT=/srv/shared/blobs\n')
    expect(deployEnvFailureDetail(path, '.env.production')).toBe('')
  })
})
