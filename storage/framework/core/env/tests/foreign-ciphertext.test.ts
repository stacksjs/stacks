/**
 * Ciphertext Bun preloaded from another environment's file.
 *
 * With NODE_ENV unset Bun loads `.env.development` natively, so a production
 * deploy (APP_ENV=production) started out holding the development file's
 * ciphertext. Loading `.env.production` only replaced the keys that file also
 * defines; the rest stayed `encrypted:...` in process.env, and the deploy's
 * mail reconcile set one of them as the live password on three production
 * mailboxes. After a load, no undecryptable ciphertext is left behind.
 */
import { afterEach, expect, spyOn, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { encryptValue, generateKeypair } from '../src/crypto'
import { loadEnv } from '../src/plugin'

const KEYS = ['FOREIGN_MAIL_PASSWORD', 'FOREIGN_COPY', 'FOREIGN_SHARED_KEY', 'FOREIGN_PROD_ONLY']
const saved = Object.fromEntries(KEYS.map(key => [key, process.env[key]]))
let dir: string | undefined

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined)
      delete process.env[key]
    else
      process.env[key] = saved[key]
  }
  if (dir)
    rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

function productionFile(publicKey: string): string {
  dir = mkdtempSync(join(tmpdir(), 'stacks-foreign-ciphertext-'))
  writeFileSync(join(dir, '.env.production'), `FOREIGN_PROD_ONLY=${encryptValue('prod-value', publicKey)}\n`)
  return dir
}

test('another environment\'s ciphertext does not survive a load', () => {
  const production = generateKeypair()
  const development = generateKeypair()
  const devCiphertext = encryptValue('dev-password', development.publicKey)
  process.env.FOREIGN_MAIL_PASSWORD = devCiphertext
  process.env.FOREIGN_COPY = `smtp://user:${devCiphertext}@host`
  const warn = spyOn(console, 'warn').mockImplementation(() => {})
  let warned = ''

  try {
    const cwd = productionFile(production.publicKey)
    loadEnv({ path: '.env.production', env: 'production', privateKey: production.privateKey, cwd, quiet: true })
    warned = warn.mock.calls.flat().join('\n')
  }
  finally {
    warn.mockRestore()
  }

  expect(process.env.FOREIGN_PROD_ONLY).toBe('prod-value')
  expect(process.env.FOREIGN_MAIL_PASSWORD).toBeUndefined()
  expect(process.env.FOREIGN_COPY).toBeUndefined()
  expect(warned).toContain('FOREIGN_MAIL_PASSWORD')
  expect(warned).not.toContain(devCiphertext)
})

test('preloaded ciphertext the loaded key can open is decrypted, not dropped', () => {
  const keys = generateKeypair()
  process.env.FOREIGN_SHARED_KEY = encryptValue('shared-value', keys.publicKey)

  const cwd = productionFile(keys.publicKey)
  loadEnv({ path: '.env.production', env: 'production', privateKey: keys.privateKey, cwd, quiet: true })

  expect(process.env.FOREIGN_SHARED_KEY).toBe('shared-value')
})
