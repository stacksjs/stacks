import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decryptValue, encryptValue, generateKeypair } from '@stacksjs/env'
import { readEnvironmentLayers, updateEnvironmentLayers } from './environment-layers'

/**
 * The env files the app loads, read and written the way it loads them
 * (stacksjs/stacks#3340): a later file wins, an encrypted entry this process
 * cannot decrypt does not, and an encrypted value stays encrypted.
 */
const directories: string[] = []

/** A project in a temp folder; every backup goes in its own `runtime/`, never the checkout's. */
function project(files: Record<string, string>): { cwd: string, backupPathFor: (file: string) => string } {
  const cwd = mkdtempSync(join(tmpdir(), 'stacks-env-layers-'))
  directories.push(cwd)
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(cwd, name), content)
  return { cwd, backupPathFor: (file: string) => join(cwd, 'runtime', `${file}.backup`) }
}

function text(cwd: string, file: string): string {
  return readFileSync(join(cwd, file), 'utf8')
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('environment layers', () => {
  test('a key set again in a later file comes from that file, and is saved there', async () => {
    const location = project({
      '.env': 'MAIL_HOST=base.test\nMAIL_PORT=25\n',
      '.env.staging': 'MAIL_HOST=staging.test\n',
    })
    const options = { ...location, env: 'staging', privateKey: null }

    const layers = await readEnvironmentLayers(options)
    expect(layers.layers.map(layer => layer.file)).toEqual(['.env', '.env.staging'])
    expect(layers.entries.MAIL_HOST).toBe('staging.test')
    expect(layers.sources).toMatchObject({ MAIL_HOST: '.env.staging', MAIL_PORT: '.env' })

    const saved = await updateEnvironmentLayers({ MAIL_HOST: 'saved.test', MAIL_PORT: '2525', MAIL_MAILER: 'smtp' }, layers.revision, options)
    expect(saved.layers?.entries).toMatchObject({ MAIL_HOST: 'saved.test', MAIL_PORT: '2525', MAIL_MAILER: 'smtp' })
    expect(text(location.cwd, '.env.staging')).toBe('MAIL_HOST=saved.test\n')
    // A key no file sets is added to `.env`.
    expect(text(location.cwd, '.env')).toBe('MAIL_HOST=base.test\nMAIL_PORT=2525\n\nMAIL_MAILER=smtp\n')
    // Each file it replaced is kept, under its own name.
    expect(text(location.cwd, 'runtime/.env.backup')).toBe('MAIL_HOST=base.test\nMAIL_PORT=25\n')
    expect(text(location.cwd, 'runtime/.env.staging.backup')).toBe('MAIL_HOST=staging.test\n')
  })

  test('an encrypted entry with no key to read it does not win, and is named', async () => {
    const { publicKey } = generateKeypair()
    const location = project({
      '.env': 'MAIL_HOST=base.test\n',
      '.env.staging': `DOTENV_PUBLIC_KEY_STAGING=${publicKey}\nMAIL_HOST="${encryptValue('staging.test', publicKey)}"\n`,
    })
    const options = { ...location, env: 'staging', privateKey: null }

    const layers = await readEnvironmentLayers(options)
    expect(layers.entries.MAIL_HOST).toBe('base.test')
    expect(layers.sources.MAIL_HOST).toBe('.env')
    expect(layers.unreadable).toEqual({ MAIL_HOST: '.env.staging' })

    const staging = text(location.cwd, '.env.staging')
    await updateEnvironmentLayers({ MAIL_HOST: 'saved.test' }, layers.revision, options)
    expect(text(location.cwd, '.env')).toBe('MAIL_HOST=saved.test\n')
    expect(text(location.cwd, '.env.staging')).toBe(staging)
  })

  test('an encrypted value is read decrypted and saved encrypted, under its file\'s key', async () => {
    const { publicKey, privateKey } = generateKeypair()
    const location = project({
      '.env': 'MAIL_HOST=base.test\n',
      '.env.staging': `DOTENV_PUBLIC_KEY_STAGING=${publicKey}\nMAIL_HOST="${encryptValue('staging.test', publicKey)}"\nMAIL_PASSWORD=plain-before\n`,
    })
    const options = { ...location, env: 'staging', privateKey, secrets: ['MAIL_PASSWORD'] }

    const layers = await readEnvironmentLayers(options)
    expect(layers.entries.MAIL_HOST).toBe('staging.test')
    expect(layers.sources.MAIL_HOST).toBe('.env.staging')

    await updateEnvironmentLayers({ MAIL_HOST: 'saved.test', MAIL_PASSWORD: 'new-secret' }, layers.revision, options)
    const staging = Object.fromEntries(text(location.cwd, '.env.staging').trim().split('\n').map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).replace(/^"|"$/g, '')]))
    expect(staging.MAIL_HOST).toStartWith('encrypted:')
    expect(decryptValue(staging.MAIL_HOST!, privateKey)).toBe('saved.test')
    // A secret is encrypted in a file that holds ciphertext, even where it was plain.
    expect(staging.MAIL_PASSWORD).toStartWith('encrypted:')
    expect(decryptValue(staging.MAIL_PASSWORD!, privateKey)).toBe('new-secret')
    expect(text(location.cwd, '.env')).toBe('MAIL_HOST=base.test\n')
    expect((await readEnvironmentLayers(options)).entries.MAIL_HOST).toBe('saved.test')
  })

  test('refuses to write a value that has to be encrypted when its file declares no public key', async () => {
    const { publicKey, privateKey } = generateKeypair()
    const location = project({ '.env.staging': `MAIL_HOST="${encryptValue('staging.test', publicKey)}"\n` })
    const options = { ...location, env: 'staging', privateKey }
    const before = text(location.cwd, '.env.staging')

    const layers = await readEnvironmentLayers(options)
    const result = await updateEnvironmentLayers({ MAIL_HOST: 'saved.test' }, layers.revision, options)
    expect(result.issues).toEqual([{ key: 'MAIL_HOST', message: '.env.staging holds encrypted values but declares no public key. Repair it before changing MAIL_HOST.' }])
    expect(text(location.cwd, '.env.staging')).toBe(before)
  })

  test('refuses a write when any file changed since it was read', async () => {
    const location = project({ '.env': 'MAIL_HOST=base.test\n', '.env.staging': 'MAIL_PORT=25\n' })
    const options = { ...location, env: 'staging', privateKey: null }
    const layers = await readEnvironmentLayers(options)

    writeFileSync(join(location.cwd, '.env.staging'), 'MAIL_PORT=587\n')
    expect(await updateEnvironmentLayers({ MAIL_HOST: 'saved.test' }, layers.revision, options)).toEqual({ conflict: true })
    expect(text(location.cwd, '.env')).toBe('MAIL_HOST=base.test\n')
  })

  test('writes .env when the project has no env file yet', async () => {
    const location = project({})
    const options = { ...location, env: 'staging', privateKey: null }
    const layers = await readEnvironmentLayers(options)
    expect(layers.layers).toEqual([])

    await updateEnvironmentLayers({ MAIL_MAILER: 'log' }, layers.revision, options)
    expect(text(location.cwd, '.env')).toBe('MAIL_MAILER=log\n')
  })
})
