/**
 * Which key an env file's values are encrypted against.
 *
 * `encryptEnv` derived that name twice — once for the keypair it wrote to
 * `.env.keys`, once for the header it wrote into the encrypted file — and the
 * two derivations disagreed for any caller that passed `--file` explicitly. A
 * file encrypted that way names a public key that is not in `.env.keys`, so
 * nothing can find the private half, and every value in it is unrecoverable.
 * That is the worst failure this module has: it is silent at the time, and the
 * data is gone by the time anyone notices.
 */

import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptEnv, envKeyNames } from '../src/cli'

describe('envKeyNames', () => {
  it('suffixes with the environment', () => {
    expect(envKeyNames('.env.production')).toEqual({
      publicKeyName: 'DOTENV_PUBLIC_KEY_PRODUCTION',
      privateKeyName: 'DOTENV_PRIVATE_KEY_PRODUCTION',
    })
  })

  it('leaves the plain .env unsuffixed, named or defaulted', () => {
    // `.env` used to become `DOTENV_PUBLIC_KEY_.ENV` when it was passed
    // explicitly, and `DOTENV_PUBLIC_KEY` when it was left to the default.
    expect(envKeyNames('.env')).toEqual(envKeyNames(undefined))
    expect(envKeyNames('.env').publicKeyName).toBe('DOTENV_PUBLIC_KEY')
  })

  it('reads the file name, not the path it sits behind', () => {
    expect(envKeyNames('secrets/.env.staging').publicKeyName).toBe('DOTENV_PUBLIC_KEY_STAGING')
  })
})

describe('encryptEnv', () => {
  /** A project directory holding `.env.<env>` with `body`. */
  function project(fileName: string, body: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-env-'))

    writeFileSync(join(dir, fileName), body)

    return dir
  }

  it('names the same key in the file it wrote and in the keys file', () => {
    /*
     * The whole bug in one assertion: the header has to name a key that
     * `.env.keys` actually holds, or the values are lost.
     */
    for (const file of ['.env', '.env.production']) {
      const cwd = project(file, 'SECRET=hunter2\n')

      expect(encryptEnv({ file, cwd }).success).toBe(true)

      const { publicKeyName, privateKeyName } = envKeyNames(file)
      const encrypted = readFileSync(join(cwd, file), 'utf-8')
      const keys = readFileSync(join(cwd, '.env.keys'), 'utf-8')

      expect(encrypted).toContain(`${publicKeyName}=`)
      expect(keys).toContain(`${publicKeyName}=`)
      expect(keys).toContain(`${privateKeyName}=`)
    }
  })

  it('encrypts the values', () => {
    const cwd = project('.env.production', 'SECRET=hunter2\n')

    encryptEnv({ file: '.env.production', cwd })

    const encrypted = readFileSync(join(cwd, '.env.production'), 'utf-8')

    expect(encrypted).not.toContain('hunter2')
    expect(encrypted).toMatch(/SECRET="encrypted:/)
  })

  it('is safe to run again', () => {
    // Every deploy runs it, so a second pass must not encrypt the ciphertext.
    const cwd = project('.env.production', 'SECRET=hunter2\n')

    encryptEnv({ file: '.env.production', cwd })
    const once = readFileSync(join(cwd, '.env.production'), 'utf-8')

    encryptEnv({ file: '.env.production', cwd })

    expect(readFileSync(join(cwd, '.env.production'), 'utf-8')).toBe(once)
  })

  it('encrypts a value added beside ones already encrypted', () => {
    const cwd = project('.env.production', 'OLD=one\n')

    encryptEnv({ file: '.env.production', cwd })
    const path = join(cwd, '.env.production')

    writeFileSync(path, `${readFileSync(path, 'utf-8')}\nNEW=two\n`)
    encryptEnv({ file: '.env.production', cwd })

    const encrypted = readFileSync(path, 'utf-8')

    expect(encrypted).not.toContain('two')
    expect(encrypted).toMatch(/NEW="encrypted:/)
    expect(encrypted).toMatch(/OLD="encrypted:/)
  })
})
