/**
 * The env file a deploy ships secrets from.
 *
 * A stacks app keeps production secrets in `.env.production`, encrypted, and
 * the deploy decrypts them locally on the way out — systemd's `EnvironmentFile`
 * is a plain `KEY=value` parser that could never do it, so this is the only
 * route a secret has to a server without lying around in plaintext.
 *
 * Nothing enforced that: a missing file resolved to `{}` and the deploy carried
 * on, so a project could keep every secret it had in the plaintext `.env` beside
 * its source and never be told. That is the state this drifts into by default,
 * and nothing surfaces it later, because everything works.
 */

import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureDeployEnvIsSet, isEnvFileEncrypted } from '../src/commands/setup'

/** An empty project directory. */
function project(): string {
  return mkdtempSync(join(tmpdir(), 'stacks-deploy-env-'))
}

describe('isEnvFileEncrypted', () => {
  it('is true for a file whose every value is ciphertext', () => {
    expect(isEnvFileEncrypted('DOTENV_PUBLIC_KEY_PRODUCTION="abc"\nAPP_KEY="encrypted:v2:xyz"\n')).toBe(true)
  })

  it('is true for a file with nothing in it yet', () => {
    // Freshly created, header only. There is nothing to protect.
    expect(isEnvFileEncrypted('# secrets for production\n\n')).toBe(true)
  })

  it('is false when one value is still readable', () => {
    // One is enough: it is the one that leaks.
    expect(isEnvFileEncrypted('A="encrypted:v2:xyz"\nB=hunter2\n')).toBe(false)
  })
})

describe('ensureDeployEnvIsSet', () => {
  it('creates the file when there is none', async () => {
    const cwd = project()

    await ensureDeployEnvIsSet(cwd, 'production')

    expect(readFileSync(join(cwd, '.env.production'), 'utf-8')).toContain('DOTENV_PUBLIC_KEY_PRODUCTION')
    expect(readFileSync(join(cwd, '.env.keys'), 'utf-8')).toContain('DOTENV_PRIVATE_KEY_PRODUCTION')
  })

  it('creates it empty, copying nothing out of .env', async () => {
    /*
     * Seeding production from the developer's `.env` would ship a laptop — a
     * localhost APP_URL, a dev database, a test Stripe key — to a real server
     * under a name that says production, and the encryption would then hide it
     * from review.
     */
    const cwd = project()
    writeFileSync(join(cwd, '.env'), 'APP_URL=http://localhost:3000\nSTRIPE_SECRET_KEY=sk_test_local\n')

    await ensureDeployEnvIsSet(cwd, 'production')

    const created = readFileSync(join(cwd, '.env.production'), 'utf-8')

    expect(created).not.toContain('localhost')
    expect(created).not.toContain('sk_test_local')
    // No assignments at all — the header names a key in an example, which is
    // documentation rather than a value.
    expect(created.split('\n').filter(line => /^[A-Z_]+=/.test(line.trim()) && !line.startsWith('DOTENV_PUBLIC_KEY'))).toEqual([])
  })

  it('encrypts a file whose secrets are still in the clear', async () => {
    // A value that reached this file was meant to be a secret. Leaving it
    // readable is the failure the whole mechanism exists to prevent.
    const cwd = project()
    writeFileSync(join(cwd, '.env.production'), 'APP_KEY=base64:realproductionkey\n')

    await ensureDeployEnvIsSet(cwd, 'production')

    const after = readFileSync(join(cwd, '.env.production'), 'utf-8')

    expect(after).not.toContain('realproductionkey')
    expect(after).toMatch(/APP_KEY="encrypted:/)
  })

  it('leaves an already-encrypted file byte for byte alone', async () => {
    // It runs on every deploy. Rewriting the file each time would put noise in
    // every diff and, worse, make a real change hard to see in review.
    const cwd = project()
    writeFileSync(join(cwd, '.env.production'), 'APP_KEY=base64:realproductionkey\n')

    await ensureDeployEnvIsSet(cwd, 'production')
    const once = readFileSync(join(cwd, '.env.production'), 'utf-8')

    await ensureDeployEnvIsSet(cwd, 'production')

    expect(readFileSync(join(cwd, '.env.production'), 'utf-8')).toBe(once)
  })

  it('encrypts a value added by hand beside encrypted ones', async () => {
    const cwd = project()
    writeFileSync(join(cwd, '.env.production'), 'APP_KEY=base64:one\n')

    await ensureDeployEnvIsSet(cwd, 'production')
    const path = join(cwd, '.env.production')
    writeFileSync(path, `${readFileSync(path, 'utf-8')}\nSTRIPE_SECRET_KEY=sk_live_two\n`)

    await ensureDeployEnvIsSet(cwd, 'production')

    expect(readFileSync(path, 'utf-8')).not.toContain('sk_live_two')
  })

  it('names the file after the environment being deployed', async () => {
    const cwd = project()

    await ensureDeployEnvIsSet(cwd, 'staging')

    expect(readFileSync(join(cwd, '.env.staging'), 'utf-8')).toContain('DOTENV_PUBLIC_KEY_STAGING')
    expect(readFileSync(join(cwd, '.env.keys'), 'utf-8')).toContain('DOTENV_PRIVATE_KEY_STAGING')
  })

  it('keeps two environments in one keys file, each with its own key', async () => {
    const cwd = project()

    await ensureDeployEnvIsSet(cwd, 'production')
    await ensureDeployEnvIsSet(cwd, 'staging')

    const keys = readFileSync(join(cwd, '.env.keys'), 'utf-8')

    expect(keys).toContain('DOTENV_PRIVATE_KEY_PRODUCTION')
    expect(keys).toContain('DOTENV_PRIVATE_KEY_STAGING')
  })

  it('leaves a developer working file alone', async () => {
    /*
     * `development` reads plain `.env` by convention. Encrypting the file
     * someone is editing would cost them their editor, and there is no server
     * on the other end of it to protect.
     */
    const cwd = project()
    writeFileSync(join(cwd, '.env'), 'APP_KEY=base64:dev\n')

    await ensureDeployEnvIsSet(cwd, 'development')

    expect(readFileSync(join(cwd, '.env'), 'utf-8')).toContain('base64:dev')
  })
})
