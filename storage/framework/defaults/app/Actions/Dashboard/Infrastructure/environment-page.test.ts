import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptValue, generateKeypair } from '@stacksjs/env'
import { readEnvironmentPage, saveEnvironmentPage } from './environment-page'

/**
 * The Environment page opens any env file the app loads, says which of its
 * keys the app reads from a later file, and keeps a backup per file
 * (stacksjs/stacks#3341).
 */
const directories: string[] = []

/** A project in a temp folder, read as `staging`; every backup goes in its own `runtime/`, never the checkout's. */
function project(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'stacks-env-page-'))
  directories.push(cwd)
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(cwd, name), content)
  return { cwd, env: 'staging', privateKey: null, backupPathFor: (file: string) => join(cwd, 'runtime', `${file}.backup`) }
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('the Environment page', () => {
  test('opens .env by default, and lists every env file the app loads', async () => {
    const options = project({ '.env': 'APP_NAME=Base\n', '.env.staging': 'APP_NAME=Staging\n', '.env.production': 'APP_NAME=Production\n' })
    const page = await readEnvironmentPage(undefined, options)
    expect(page?.environment).toMatchObject({ path: '.env', content: 'APP_NAME=Base\n' })
    // `.env.production` is not loaded as staging, so it is not offered.
    expect(page?.files).toEqual(['.env', '.env.staging'])
  })

  test('names the keys a later file sets again', async () => {
    const { publicKey } = generateKeypair()
    const options = project({
      '.env': 'APP_NAME=Base\nAPP_URL=base.test\nAPP_KEY=base-key\n',
      '.env.local': `APP_URL=local.test\nAPP_KEY="${encryptValue('local-key', publicKey)}"\n`,
    })
    expect((await readEnvironmentPage('.env', options))?.readElsewhere).toEqual([
      { key: 'APP_URL', file: '.env.local', readable: true },
      { key: 'APP_KEY', file: '.env.local', readable: false },
    ])
    expect((await readEnvironmentPage('.env.local', options))?.readElsewhere).toEqual([])
  })

  test('opens only an env file the app loads', async () => {
    const options = project({ '.env': 'APP_NAME=Base\n', '.env.production': 'APP_NAME=Production\n' })
    for (const requested of ['.env.production', '../.env', '/etc/passwd', 'config/app.ts', 42])
      expect(await readEnvironmentPage(requested, options)).toBeNull()
    expect(await saveEnvironmentPage('.env.production', 'APP_NAME=Changed\n', '0'.repeat(64), options)).toEqual({ unknownFile: true })
    expect(readFileSync(join(options.cwd, '.env.production'), 'utf8')).toBe('APP_NAME=Production\n')
  })

  test('saves the file it opened, and keeps that file\'s own backup', async () => {
    const options = project({ '.env': 'APP_NAME=Base\n', '.env.staging': 'APP_NAME=Staging\n' })
    const page = await readEnvironmentPage('.env.staging', options)

    const saved = await saveEnvironmentPage('.env.staging', 'APP_NAME=Saved\n', page!.environment.revision, options)
    expect(saved.page?.environment).toMatchObject({ path: '.env.staging', content: 'APP_NAME=Saved\n' })
    expect(saved.page?.environment.backup.content).toBe('APP_NAME=Staging\n')
    expect(readFileSync(join(options.cwd, '.env.staging'), 'utf8')).toBe('APP_NAME=Saved\n')
    expect(readFileSync(join(options.cwd, 'runtime/.env.staging.backup'), 'utf8')).toBe('APP_NAME=Staging\n')
    expect(readFileSync(join(options.cwd, '.env'), 'utf8')).toBe('APP_NAME=Base\n')
    expect(existsSync(join(options.cwd, 'runtime/.env.backup'))).toBe(false)
  })
})
