import { describe, expect, it } from 'bun:test'
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
