import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { EXPECTED_LOCKFILE_VERSION, lockfileVersion } from './check-lockfile-version'

describe('bun.lock version guard', () => {
  it('parses the lockfileVersion field', () => {
    expect(lockfileVersion('{\n  "lockfileVersion": 1,\n')).toBe(1)
    expect(lockfileVersion('{\n  "lockfileVersion": 2,\n  "configVersion": 1,\n')).toBe(2)
  })

  it('returns null when the field is absent', () => {
    expect(lockfileVersion('{}')).toBeNull()
  })

  it('the committed bun.lock is the CI-compatible version', () => {
    const contents = readFileSync(resolve(import.meta.dir, '..', 'bun.lock'), 'utf8')
    expect(lockfileVersion(contents)).toBe(EXPECTED_LOCKFILE_VERSION)
  })
})
