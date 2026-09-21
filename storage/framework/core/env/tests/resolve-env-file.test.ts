import { describe, expect, it } from 'bun:test'
import { resolveEnvFile } from '../src/cli'

describe('resolveEnvFile', () => {
  it('targets the environment file when only --env is given', () => {
    expect(resolveEnvFile('', 'production')).toBe('.env.production')
    expect(resolveEnvFile(undefined, 'staging')).toBe('.env.staging')
  })

  it('lets an explicit --file win, since it names a path outright', () => {
    expect(resolveEnvFile('.env.local', 'production')).toBe('.env.local')
  })

  it('keeps the plain .env convention for development', () => {
    // The empty string means "caller keeps its own default", which is `.env`.
    expect(resolveEnvFile('', 'development')).toBe('')
    expect(resolveEnvFile('', 'dev')).toBe('')
    expect(resolveEnvFile('', 'local')).toBe('')
  })

  it('falls back to the default when no environment is set', () => {
    expect(resolveEnvFile('', '')).toBe('')
    expect(resolveEnvFile(undefined, undefined)).toBe('')
    expect(resolveEnvFile('', '   ')).toBe('')
  })

  it('refuses an environment that is really a path', () => {
    // An environment names a file suffix, never a traversal.
    expect(resolveEnvFile('', '../../etc/passwd')).toBe('')
    expect(resolveEnvFile('', 'prod/../..')).toBe('')
    expect(resolveEnvFile('', 'a b')).toBe('')
  })

  it('trims an environment that arrived with whitespace', () => {
    expect(resolveEnvFile('', ' production ')).toBe('.env.production')
  })
})
