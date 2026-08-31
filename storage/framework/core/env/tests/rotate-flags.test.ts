/**
 * `env:rotate --dry-run` and `--stdout`.
 *
 * Both flags are advertised on the command, and neither did what it says. The
 * asymmetry is the point: `--dry-run` was not implemented at all and performed
 * a real rotation, while `--stdout` was half-implemented, which is worse. It
 * replaced the keypair in `.env.keys` and printed the re-encrypted file instead
 * of writing it, so the file left on disk was still encrypted under a private
 * key that had just been overwritten. Every value in it became unrecoverable
 * (stacksjs/stacks#2398).
 *
 * So these tests are mostly about what is NOT on disk afterwards, and about the
 * output of `--stdout` being a usable pair rather than half of one.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { encryptEnv, getEnv, rotateKeypair } from '../src/cli'
import { parse } from '../src/parser'

const directories: string[] = []

/** An encrypted `.env.production` plus the `.env.keys` that opens it. */
function encryptedProject(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-env-rotate-flags-'))
  directories.push(directory)
  writeFileSync(join(directory, '.env.production'), 'APP_NAME=Acme\nDB_PASSWORD=hunter2\nAPI_TOKEN=abc123\n', { mode: 0o600 })
  const encrypted = encryptEnv({ file: '.env.production', cwd: directory })
  expect(encrypted.success).toBe(true)
  return directory
}

const bytes = (directory: string, file: string): string => readFileSync(join(directory, file), 'utf8')

/** What the values decrypt to right now, using whatever `.env.keys` holds. */
const readSecret = (directory: string): string | undefined =>
  getEnv('DB_PASSWORD', { file: '.env.production', cwd: directory }).output

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

describe('env:rotate --dry-run', () => {
  it('writes to neither file and leaves the values readable', () => {
    const directory = encryptedProject()
    const before = { env: bytes(directory, '.env.production'), keys: bytes(directory, '.env.keys') }

    const result = rotateKeypair({ file: '.env.production', cwd: directory, dryRun: true })

    expect(result.success).toBe(true)
    expect(bytes(directory, '.env.production')).toBe(before.env)
    expect(bytes(directory, '.env.keys')).toBe(before.keys)
    // The whole failure was a "preview" that destroyed the key. If the secret
    // still reads back, the keypair on disk is still the file's own.
    expect(readSecret(directory)).toBe('hunter2')
    expect(readdirSync(directory).filter(name => name.endsWith('.rotate'))).toEqual([])
  })

  it('reports what would change, naming both files and counting the values', () => {
    const directory = encryptedProject()

    const result = rotateKeypair({ file: '.env.production', cwd: directory, dryRun: true })

    expect(result.output).toContain('nothing was written')
    expect(result.output).toContain('.env.production: 3 values would be re-encrypted')
    expect(result.output).toContain('.env.keys: DOTENV_PUBLIC_KEY_PRODUCTION and DOTENV_PRIVATE_KEY_PRODUCTION would be replaced')
  })

  it('counts only the values the same run would actually re-encrypt', () => {
    // The count comes from the predicate the encrypt pass itself uses, so
    // `--exclude-key` cannot make the preview disagree with the rotation.
    const directory = encryptedProject()

    const result = rotateKeypair({ file: '.env.production', cwd: directory, excludeKey: 'TOKEN', dryRun: true })

    expect(result.output).toContain('2 values would be re-encrypted')
  })

  it('wins when --stdout is passed as well', () => {
    // Asking for both should get the one that cannot lose anything.
    const directory = encryptedProject()
    const before = { env: bytes(directory, '.env.production'), keys: bytes(directory, '.env.keys') }

    const result = rotateKeypair({ file: '.env.production', cwd: directory, dryRun: true, stdout: true })

    expect(result.output).toContain('nothing was written')
    expect(result.notice).toBeUndefined()
    expect(bytes(directory, '.env.production')).toBe(before.env)
    expect(bytes(directory, '.env.keys')).toBe(before.keys)
  })
})

describe('env:rotate --stdout', () => {
  it('writes to neither file and leaves the values readable', () => {
    const directory = encryptedProject()
    const before = { env: bytes(directory, '.env.production'), keys: bytes(directory, '.env.keys') }

    const result = rotateKeypair({ file: '.env.production', cwd: directory, stdout: true })

    expect(result.success).toBe(true)
    expect(bytes(directory, '.env.production')).toBe(before.env)
    // This is the regression. `.env.keys` used to be rewritten here, which
    // overwrote the private key the untouched file above is encrypted under.
    expect(bytes(directory, '.env.keys')).toBe(before.keys)
    expect(readSecret(directory)).toBe('hunter2')
    expect(readdirSync(directory).filter(name => name.endsWith('.rotate'))).toEqual([])
  })

  it('hands back a usable pair, not half of one', () => {
    const directory = encryptedProject()

    const result = rotateKeypair({ file: '.env.production', cwd: directory, stdout: true })

    // Adopt the output exactly as the notice instructs, and the values have to
    // come back. Printing ciphertext whose private key was never reported is
    // the same lost-secret outcome by a different route, so this is asserted
    // end to end rather than by checking the notice merely mentions a key.
    const adopted = mkdtempSync(join(tmpdir(), 'stacks-env-rotate-adopt-'))
    directories.push(adopted)
    const { parsed } = parse(result.notice!)
    writeFileSync(join(adopted, '.env.production'), result.output!, { mode: 0o600 })
    writeFileSync(join(adopted, '.env.keys'), [
      `DOTENV_PUBLIC_KEY_PRODUCTION="${parsed.DOTENV_PUBLIC_KEY_PRODUCTION}"`,
      `DOTENV_PRIVATE_KEY_PRODUCTION="${parsed.DOTENV_PRIVATE_KEY_PRODUCTION}"`,
      '',
    ].join('\n'), { mode: 0o600 })

    expect(readSecret(adopted)).toBe('hunter2')
  })

  it('keeps the keypair out of the redirectable output', () => {
    // `env:rotate --stdout > file` has to produce a valid env file, so the
    // private key belongs on the other stream.
    const directory = encryptedProject()

    const result = rotateKeypair({ file: '.env.production', cwd: directory, stdout: true })

    expect(result.output).not.toContain('x25519-private:')
    expect(result.notice).toContain('x25519-private:')
  })
})

describe('env:rotate with no flags', () => {
  it('still rotates both files together', () => {
    // The control. The flags above write nothing; the command itself has to
    // keep writing both halves, or the fix traded one lost secret for another.
    const directory = encryptedProject()
    const before = { env: bytes(directory, '.env.production'), keys: bytes(directory, '.env.keys') }

    const result = rotateKeypair({ file: '.env.production', cwd: directory })

    expect(result.success).toBe(true)
    expect(bytes(directory, '.env.production')).not.toBe(before.env)
    expect(bytes(directory, '.env.keys')).not.toBe(before.keys)
    expect(readSecret(directory)).toBe('hunter2')
  })
})
