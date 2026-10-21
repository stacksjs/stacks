import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptEnv, getEnv, resolveEnvPrivateKey, setEnv } from '../src/cli'
import { encryptValue, generateKeypair } from '../src/crypto'

test.each(['local-scoped', 'process-scoped', 'local-generic', 'process-generic'] as const)('CLI file operations select %s ahead of conflicting fallback keys', (source) => {
  const cwd = mkdtempSync(join(tmpdir(), 'stacks-key-resolution-'))
  const selected = generateKeypair()
  const stale = generateKeypair()
  const names = ['DOTENV_PRIVATE_KEY_PRODUCTION', 'DOTENV_PRIVATE_KEY']
  const previous = names.map(name => process.env[name])
  for (const name of names) delete process.env[name]
  try {
    let local = ''
    if (source === 'local-scoped') {
      local = `DOTENV_PRIVATE_KEY_PRODUCTION="${selected.privateKey}"\n`
      process.env.DOTENV_PRIVATE_KEY_PRODUCTION = stale.privateKey
    }
    else if (source === 'process-scoped') {
      local = `DOTENV_PRIVATE_KEY="${stale.privateKey}"\n`
      process.env.DOTENV_PRIVATE_KEY_PRODUCTION = selected.privateKey
    }
    else if (source === 'local-generic') {
      local = `DOTENV_PRIVATE_KEY="${selected.privateKey}"\n`
      process.env.DOTENV_PRIVATE_KEY = stale.privateKey
    }
    else process.env.DOTENV_PRIVATE_KEY = selected.privateKey
    if (local) writeFileSync(join(cwd, '.env.keys'), local, { mode: 0o600 })
    writeFileSync(join(cwd, '.env.production'), `DOTENV_PUBLIC_KEY_PRODUCTION="${selected.publicKey}"\nAPP_KEY="${encryptValue('selected-fixture', selected.publicKey)}"\nPLAIN=fixture\n`)
    const options = { file: '.env.production', cwd }
    expect(resolveEnvPrivateKey(options)).toBe(selected.privateKey)
    expect(getEnv('APP_KEY', options).output).toBe('selected-fixture')
    expect(setEnv('NEXT', 'next-fixture', options).success).toBe(true)
    expect(getEnv('NEXT', options).output).toBe('next-fixture')
    expect(encryptEnv(options).success).toBe(true)
    expect(getEnv('PLAIN', options).output).toBe('fixture')
  }
  finally {
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name]
      else process.env[name] = previous[i]
    })
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('the selected file scope and explicit external keys file determine CLI resolution', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'stacks-key-resolution-scope-'))
  const selected = generateKeypair()
  const stale = generateKeypair()
  const keysFile = join(cwd, 'external.keys')
  const previous = process.env.DOTENV_PRIVATE_KEY_STAGING
  try {
    process.env.DOTENV_PRIVATE_KEY_STAGING = stale.privateKey
    writeFileSync(join(cwd, '.env.keys'), `DOTENV_PRIVATE_KEY_STAGING="${stale.privateKey}"\n`, { mode: 0o600 })
    writeFileSync(keysFile, `DOTENV_PRIVATE_KEY_PRODUCTION="${stale.privateKey}"\nDOTENV_PRIVATE_KEY_STAGING="${selected.privateKey}"\n`, { mode: 0o600 })
    writeFileSync(join(cwd, '.env.staging'), `APP_KEY="${encryptValue('staging-fixture', selected.publicKey)}"\n`)
    const options = { cwd, file: '.env.staging', keysFile }
    expect(resolveEnvPrivateKey(options)).toBe(selected.privateKey)
    expect(getEnv('APP_KEY', options).output).toBe('staging-fixture')
  }
  finally {
    if (previous === undefined) delete process.env.DOTENV_PRIVATE_KEY_STAGING
    else process.env.DOTENV_PRIVATE_KEY_STAGING = previous
    rmSync(cwd, { recursive: true, force: true })
  }
})
