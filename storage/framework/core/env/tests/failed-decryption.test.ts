import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptValue, generateKeypair } from '../src/crypto'
import { parse } from '../src/parser'
import { loadEnv } from '../src/plugin'

test('failed decryption excludes ciphertext from usable parsed values (#2596)', () => {
  const ciphertext = encryptValue('fixture-profile', generateKeypair().publicKey)
  const wrongKey = generateKeypair().privateKey
  const result = parse(`FAILED_DECRYPT_VALUE=${ciphertext}`, { privateKey: wrongKey, processEnv: {} })

  expect(Object.hasOwn(result.parsed, 'FAILED_DECRYPT_VALUE')).toBe(false)
  expect(result.skippedEncrypted).toEqual(['FAILED_DECRYPT_VALUE'])
  expect(result.errors).toHaveLength(1)
  expect(result.errors[0]).toContain('FAILED_DECRYPT_VALUE')
  expect(result.errors[0]).not.toContain(ciphertext)
  expect(result.errors[0]).not.toContain(wrongKey)
})

for (const prefix of ['encrypted:', 'enc:']) {
  test(`${prefix} variable expansion cannot reintroduce rejected ciphertext`, () => {
    const ciphertext = encryptValue('fixture-profile', generateKeypair().publicKey).replace(/^encrypted:/, prefix)
    const result = parse(`BEFORE=\${FAILED_DECRYPT_VALUE:-fallback}\nFAILED_DECRYPT_VALUE=${ciphertext}\nCOPY=\${FAILED_DECRYPT_VALUE:-fallback}\nURL=https://example.invalid/\${FAILED_DECRYPT_VALUE}`, {
      privateKey: generateKeypair().privateKey,
      processEnv: { FAILED_DECRYPT_VALUE: ciphertext, PRELOADED_URL: `https://example.invalid/${ciphertext}` },
    })

    expect(result.parsed).toEqual({ BEFORE: 'fallback', COPY: 'fallback', URL: 'https://example.invalid/' })
    const dependent = parse('COPY=${PRELOADED_URL:-fallback}', {
      processEnv: { FAILED_DECRYPT_VALUE: ciphertext, PRELOADED_URL: `https://example.invalid/${ciphertext}` },
    })
    expect(dependent.parsed.COPY).toBe('fallback')
  })
}

test('variable expansion still reads decrypted entries and genuine plaintext overrides', () => {
  const keys = generateKeypair()
  const ciphertext = encryptValue('fixture-profile', keys.publicKey)
  const content = `FAILED_DECRYPT_VALUE=${ciphertext}\nCOPY=\${FAILED_DECRYPT_VALUE}`

  const decrypted = parse(content, { privateKey: keys.privateKey, processEnv: { FAILED_DECRYPT_VALUE: ciphertext } })
  expect(decrypted.parsed.COPY).toBe('fixture-profile')

  const overridden = parse(content, { privateKey: generateKeypair().privateKey, processEnv: { FAILED_DECRYPT_VALUE: 'from-shell' } })
  expect(overridden.parsed).toEqual({ COPY: 'from-shell' })
})

describe('unusable encrypted environment entries (#2596)', () => {
  const envKeys = ['FAILED_DECRYPT_VALUE', 'FAILED_DECRYPT_PLAIN', 'FAILED_DECRYPT_COPY', 'DOTENV_PRIVATE_KEY', 'DOTENV_PRIVATE_KEY_FAILURE_FIXTURE']
  let dir: string
  let saved: Array<[string, string | undefined]>
  let warning: ReturnType<typeof spyOn<typeof console, 'warn'>>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'env-failed-decryption-'))
    saved = envKeys.map(key => [key, process.env[key]])
    for (const key of envKeys)
      delete process.env[key]
    warning = spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warning.mockRestore()
    for (const [key, value] of saved) {
      if (value === undefined)
        delete process.env[key]
      else
        process.env[key] = value
    }
    rmSync(dir, { recursive: true, force: true })
  })

  for (const prefix of ['encrypted:', 'enc:']) {
    for (const failure of ['wrong key', 'malformed value', 'no key']) {
      test(`${prefix} ${failure}: skips the entry and scrubs Bun-preloaded ciphertext`, () => {
        const keys = generateKeypair()
        const ciphertext = failure === 'malformed value'
          ? `${prefix}v2:not-an-envelope`
          : encryptValue('fixture-profile', keys.publicKey).replace(/^encrypted:/, prefix)
        const privateKey = failure === 'no key' ? undefined : generateKeypair().privateKey
        const content = `FAILED_DECRYPT_VALUE=${ciphertext}\nFAILED_DECRYPT_PLAIN=still-loaded`
        const parsed = parse(content, { privateKey, processEnv: {} })

        expect(parsed.parsed).toEqual({ FAILED_DECRYPT_PLAIN: 'still-loaded' })
        expect(parsed.skippedEncrypted).toEqual(['FAILED_DECRYPT_VALUE'])
        expect(parsed.errors).toHaveLength(failure === 'no key' ? 0 : 1)

        writeFileSync(join(dir, '.env'), content)
        process.env.FAILED_DECRYPT_VALUE = ciphertext
        const result = loadEnv({ cwd: dir, env: 'failure_fixture', privateKey, quiet: true })

        expect(result.loaded).toBe(1)
        expect(result.errors).toEqual(parsed.errors)
        expect(process.env.FAILED_DECRYPT_VALUE).toBeUndefined()
        expect(process.env.FAILED_DECRYPT_PLAIN).toBe('still-loaded')
        expect(warning).toHaveBeenCalledTimes(1)
        const diagnostic = warning.mock.calls.flat().join(' ')
        expect(diagnostic).toContain('FAILED_DECRYPT_VALUE')
        expect(diagnostic).not.toContain(ciphertext)
        if (privateKey) {
          expect(diagnostic).not.toContain(privateKey)
          expect(diagnostic).not.toContain('not set')
        }
      })
    }

    test(`${prefix} a valid key still replaces preloaded ciphertext`, () => {
      const keys = generateKeypair()
      const ciphertext = encryptValue('fixture-profile', keys.publicKey).replace(/^encrypted:/, prefix)
      writeFileSync(join(dir, '.env'), `FAILED_DECRYPT_VALUE=${ciphertext}`)
      process.env.FAILED_DECRYPT_VALUE = ciphertext

      const result = loadEnv({ cwd: dir, env: 'failure_fixture', privateKey: keys.privateKey, quiet: true })

      expect(result).toEqual({ loaded: 1, errors: [] })
      expect(process.env.FAILED_DECRYPT_VALUE).toBe('fixture-profile')
      expect(warning).not.toHaveBeenCalled()
    })
  }

  for (const overload of [false, true]) {
    for (const prefix of ['encrypted:', 'enc:']) {
      test(`${prefix} does not carry failed ciphertext into a later file with overload=${overload}`, () => {
        const ciphertext = encryptValue('fixture-profile', generateKeypair().publicKey).replace(/^encrypted:/, prefix)
        writeFileSync(join(dir, '.env'), `FAILED_DECRYPT_VALUE=${ciphertext}`)
        writeFileSync(join(dir, '.env.local'), 'FAILED_DECRYPT_COPY=${FAILED_DECRYPT_PLAIN:-fallback}\nFAILED_DECRYPT_PLAIN=local-value')
        process.env.FAILED_DECRYPT_VALUE = ciphertext
        process.env.FAILED_DECRYPT_PLAIN = `https://example.invalid/${ciphertext}`

        const result = loadEnv({ path: ['.env', '.env.local'], cwd: dir, env: 'failure_fixture', privateKey: generateKeypair().privateKey, overload, quiet: true })

        expect(result.errors).toHaveLength(1)
        expect(process.env.FAILED_DECRYPT_COPY).toBe('fallback')
        expect(process.env.FAILED_DECRYPT_PLAIN).toBe('local-value')
        expect(process.env.FAILED_DECRYPT_VALUE).toBeUndefined()
      })

      test(`${prefix} replaces a Bun-expanded URL containing failed ciphertext with overload=${overload}`, () => {
        const ciphertext = encryptValue('fixture-profile', generateKeypair().publicKey).replace(/^encrypted:/, prefix)
        writeFileSync(join(dir, '.env'), `FAILED_DECRYPT_VALUE=${ciphertext}\nFAILED_DECRYPT_PLAIN=https://example.invalid/\${FAILED_DECRYPT_VALUE}`)
        process.env.FAILED_DECRYPT_VALUE = ciphertext
        process.env.FAILED_DECRYPT_PLAIN = `https://example.invalid/${ciphertext}`

        const result = loadEnv({ cwd: dir, env: 'failure_fixture', privateKey: generateKeypair().privateKey, overload, quiet: true })

        expect(result.errors).toHaveLength(1)
        expect(process.env.FAILED_DECRYPT_VALUE).toBeUndefined()
        expect(process.env.FAILED_DECRYPT_PLAIN).toBe('https://example.invalid/')
      })
    }

    test(`failed ciphertext cannot reach a different process variable with overload=${overload}`, () => {
      const ciphertext = encryptValue('fixture-profile', generateKeypair().publicKey)
      writeFileSync(join(dir, '.env'), `FAILED_DECRYPT_VALUE=${ciphertext}\nFAILED_DECRYPT_PLAIN=\${FAILED_DECRYPT_VALUE:-fallback}`)
      process.env.FAILED_DECRYPT_VALUE = ciphertext

      const result = loadEnv({ cwd: dir, env: 'failure_fixture', privateKey: generateKeypair().privateKey, overload, quiet: true })

      expect(result.loaded).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(process.env.FAILED_DECRYPT_VALUE).toBeUndefined()
      expect(process.env.FAILED_DECRYPT_PLAIN).toBe('fallback')
    })

    test(`failed decryption preserves a genuine shell override with overload=${overload}`, () => {
      const ciphertext = encryptValue('fixture-profile', generateKeypair().publicKey)
      writeFileSync(join(dir, '.env'), `FAILED_DECRYPT_VALUE=${ciphertext}`)
      process.env.FAILED_DECRYPT_VALUE = 'from-shell'

      const result = loadEnv({ cwd: dir, env: 'failure_fixture', privateKey: generateKeypair().privateKey, overload, quiet: true })

      expect(result.loaded).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(process.env.FAILED_DECRYPT_VALUE).toBe('from-shell')
    })
  }

  test('keeps a genuine external URL containing only a ciphertext-like word', () => {
    const ciphertext = encryptValue('fixture-profile', generateKeypair().publicKey)
    writeFileSync(join(dir, '.env'), `FAILED_DECRYPT_VALUE=${ciphertext}\nFAILED_DECRYPT_PLAIN=from-file`)
    process.env.FAILED_DECRYPT_VALUE = ciphertext
    process.env.FAILED_DECRYPT_PLAIN = 'https://example.invalid/encrypted:documentation'

    loadEnv({ cwd: dir, env: 'failure_fixture', privateKey: generateKeypair().privateKey, quiet: true })

    expect(process.env.FAILED_DECRYPT_PLAIN).toBe('https://example.invalid/encrypted:documentation')
  })
})
