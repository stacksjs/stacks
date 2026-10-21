import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { encryptValue, generateKeypair } from '../../env/src/crypto'
import { parseEnvAssignments } from '../src/commands/env'

/**
 * `env:check` used to read the file with `storage.readTextFile`, which resolves
 * a `{ path, data }` TextFile, and then `String(…)` it. That yields the literal
 * "[object Object]" - 15 characters, no newlines - so every check ran against a
 * single bogus line. A 67-key `.env.production` reported "1 variables defined",
 * "APP_KEY not found" and "encryption keys not configured".
 *
 * Splitting on newlines is not enough either: dotenvx ciphertext wraps across
 * many lines inside its quotes, so each fragment would be counted as its own
 * (unparseable) line and the key it belongs to would be lost - which is exactly
 * how 21 foreign-tenant keys stayed invisible.
 */

describe('parseEnvAssignments', () => {
  it('parses plain assignments', () => {
    expect(parseEnvAssignments('APP_NAME=Stacks\nAPP_ENV=production')).toEqual({
      APP_NAME: 'Stacks',
      APP_ENV: 'production',
    })
  })

  it('skips comments and blank lines', () => {
    const parsed = parseEnvAssignments([
      '# Production Environment Configuration',
      '',
      '  # indented comment',
      'APP_NAME=Stacks',
    ].join('\n'))

    expect(parsed).toEqual({ APP_NAME: 'Stacks' })
  })

  it('strips surrounding quotes', () => {
    expect(parseEnvAssignments('A="double"\nB=\'single\'')).toEqual({ A: 'double', B: 'single' })
  })

  it('keeps a value containing = intact', () => {
    // Base64 keys carry `=` padding, and `split('=')[1]` would truncate them.
    expect(parseEnvAssignments('APP_KEY=base64:aGVsbG8=')).toEqual({ APP_KEY: 'base64:aGVsbG8=' })
  })

  it('joins a quoted value that wraps across lines', () => {
    const parsed = parseEnvAssignments([
      'APP_KEY="encrypted:wx6j3jWhH19YmtD/FgbPuaGdrBLQpV96',
      'E0hRBugBa5zteS2dj7iOjIxauJTcv8W6Dul3i3dvtry1GLsvG"',
      'APP_URL=https://stacksjs.com',
    ].join('\n'))

    expect(parsed.APP_KEY).toBe(
      'encrypted:wx6j3jWhH19YmtD/FgbPuaGdrBLQpV96E0hRBugBa5zteS2dj7iOjIxauJTcv8W6Dul3i3dvtry1GLsvG',
    )
    // The key after a wrapped value must still be found.
    expect(parsed.APP_URL).toBe('https://stacksjs.com')
  })

  it('handles an export prefix', () => {
    expect(parseEnvAssignments('export APP_NAME=Stacks')).toEqual({ APP_NAME: 'Stacks' })
  })

  it('drops an inline comment from an unquoted value', () => {
    expect(parseEnvAssignments('PORT=3000 # the api port')).toEqual({ PORT: '3000' })
  })

  it('keeps a # inside a quoted value', () => {
    expect(parseEnvAssignments('COLOR="#ff0000"')).toEqual({ COLOR: '#ff0000' })
  })

  it('records an empty value rather than dropping the key', () => {
    // `env:check` distinguishes "APP_KEY missing" from "APP_KEY empty".
    expect(parseEnvAssignments('APP_KEY=')).toEqual({ APP_KEY: '' })
  })

  it('tolerates CRLF line endings', () => {
    expect(parseEnvAssignments('A=1\r\nB=2')).toEqual({ A: '1', B: '2' })
  })

  it('lets a later assignment win', () => {
    expect(parseEnvAssignments('A=1\nA=2')).toEqual({ A: '2' })
  })

  it('ignores lines that are not assignments', () => {
    expect(parseEnvAssignments('#/---[DOTENV_PUBLIC_KEY]---/\nnot an assignment\nA=1')).toEqual({ A: '1' })
  })
})

describe('env:check production key presence', () => {
  it.each(['production', 'production-environment', 'generic', 'production-file', 'generic-file', 'absent', 'staging', 'empty', 'unrelated-file', 'empty-file'] as const)('reports %s key configuration without revealing values', async (source) => {
    const cwd = mkdtempSync(join(tmpdir(), 'buddy-env-check-key-'))
    const checkout = resolve(import.meta.dir, '../../../../..')
    const keys = generateKeypair()
    const payload = 'check-private-fixture-value'
    try {
      writeFileSync(join(cwd, '.env.production'), `DOTENV_PUBLIC_KEY_PRODUCTION="${keys.publicKey}"\nAPP_KEY="${encryptValue(payload, keys.publicKey)}"\n`)
      if (source === 'unrelated-file') writeFileSync(join(cwd, '.env.keys'), `DOTENV_PRIVATE_KEY_STAGING="${keys.privateKey}"\n`, { mode: 0o600 })
      if (source === 'production-file') writeFileSync(join(cwd, '.env.keys'), `DOTENV_PRIVATE_KEY_PRODUCTION="${keys.privateKey}"\n`, { mode: 0o600 })
      if (source === 'generic-file') writeFileSync(join(cwd, '.env.keys'), `DOTENV_PRIVATE_KEY="${keys.privateKey}"\n`, { mode: 0o600 })
      if (source === 'empty-file') writeFileSync(join(cwd, '.env.keys'), 'DOTENV_PRIVATE_KEY_PRODUCTION=""\n', { mode: 0o600 })
      const runner = join(cwd, 'buddy.ts')
      writeFileSync(runner, `import { cli } from ${JSON.stringify(join(checkout, 'storage/framework/core/cli/src/index.ts'))}
import { env } from ${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/env.ts'))}
const buddy = cli('buddy')
buddy.option('--env [environment]', 'Environment')
env(buddy)
await buddy.parse()
`)
      const result = Bun.spawnSync([
        process.execPath, '--no-env-file', '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'),
        runner, 'env:check', ...(source === 'production-environment' ? ['--env', 'production'] : ['--file', '.env.production']),
      ], {
        cwd,
        env: {
          PATH: process.env.PATH, APP_ENV: 'test', NODE_ENV: 'test',
          ...(source === 'production' || source === 'production-environment' ? { DOTENV_PRIVATE_KEY_PRODUCTION: keys.privateKey } : {}),
          ...(source === 'generic' ? { DOTENV_PRIVATE_KEY: keys.privateKey } : {}),
          ...(source === 'staging' ? { DOTENV_PRIVATE_KEY_STAGING: keys.privateKey } : {}),
          ...(source === 'empty' ? { DOTENV_PRIVATE_KEY_PRODUCTION: '' } : {}),
        },
        stdout: 'pipe', stderr: 'pipe',
      })
      const transcript = `${result.stdout}\n${result.stderr}`
      expect(result.exitCode, transcript).toBe(0)
      expect(transcript).toContain(['production', 'production-environment', 'generic', 'production-file', 'generic-file'].includes(source)
        ? 'Public and private keys configured'
        : 'Incomplete keypair')
      expect(transcript).not.toContain(keys.privateKey)
      expect(transcript).not.toContain(payload)
    }
    finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})

describe('env:check strict committed encryption metadata', () => {
  it.each(['valid', 'mismatched-header', 'mismatched-header-local-key', 'mismatched-header-nonstrict', 'private-header', 'malformed', 'legacy', 'trailing-plaintext', 'private-assignment', 'empty-header'] as const)('checks %s without printing key material', async (variant) => {
    const cwd = mkdtempSync(join(tmpdir(), 'buddy-env-check-metadata-'))
    const checkout = resolve(import.meta.dir, '../../../../..')
    const keys = generateKeypair()
    const fixtureSecret = 'metadata-fixture-must-stay-private'
    const publicValue = variant.startsWith('mismatched-header') ? generateKeypair().publicKey
      : variant === 'private-header' ? keys.privateKey
      : variant === 'malformed' ? fixtureSecret
        : variant === 'legacy' ? 'a'.repeat(64)
          : variant === 'empty-header' ? '' : keys.publicKey
    try {
      const suffix = variant === 'trailing-plaintext' ? ` PLAINTEXT_SECRET="${fixtureSecret}"` : ''
      const privateAssignment = variant === 'private-assignment' ? `DOTENV_PRIVATE_KEY_PRODUCTION="${keys.privateKey}"\n` : ''
      writeFileSync(join(cwd, '.env.production'), `DOTENV_PUBLIC_KEY_PRODUCTION="${publicValue}"${suffix}\nAPP_KEY="${encryptValue(fixtureSecret, keys.publicKey)}"\n${privateAssignment}`)
      if (variant === 'mismatched-header-local-key')
        writeFileSync(join(cwd, '.env.keys'), `DOTENV_PRIVATE_KEY_PRODUCTION="${keys.privateKey}"\n`, { mode: 0o600 })
      for (const args of [['init', '-q'], ['add', '.env.production']]) {
        const initialized = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
        expect(initialized.exitCode).toBe(0)
      }
      const runner = join(cwd, 'buddy.ts')
      writeFileSync(runner, `import { cli } from ${JSON.stringify(join(checkout, 'storage/framework/core/cli/src/index.ts'))}
import { getEnv } from ${JSON.stringify(join(checkout, 'storage/framework/core/env/src/cli.ts'))}
import { env } from ${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/env.ts'))}
if (!getEnv(undefined, { file: '.env.production' }).success) throw new Error('Fixture must remain decryptable')
const buddy = cli('buddy')
env(buddy)
await buddy.parse()
`)
      const child = Bun.spawnSync([
        process.execPath, '--no-env-file', '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'),
        runner, 'env:check', '--file', '.env.production', ...(variant === 'mismatched-header-nonstrict' ? [] : ['--strict']),
      ], {
        cwd,
        env: { PATH: process.env.PATH, APP_ENV: 'test', NODE_ENV: 'test', ...(variant === 'mismatched-header-local-key' ? {} : { DOTENV_PRIVATE_KEY_PRODUCTION: keys.privateKey }) },
        stdout: 'pipe', stderr: 'pipe',
      })
      const output = `${child.stdout}\n${child.stderr}`
      expect(output).not.toContain('Fixture must remain decryptable')
      expect(output).not.toContain(keys.privateKey)
      expect(output).not.toContain(fixtureSecret)
      if (variant === 'valid' || variant === 'mismatched-header-nonstrict') expect(child.exitCode, output).toBe(0)
      else {
        expect(child.exitCode, output).not.toBe(0)
        expect(output).toContain('Encryption metadata')
        expect(output).toContain('buddy env:rotate')
      }
    }
    finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
