import { describe, expect, it } from 'bun:test'
import { hasDependencyStateChange, isDependencyCommit } from '../scripts/check-dependency-commits'

describe('dependency commit integrity', () => {
  it('recognizes dependency commit subjects', () => {
    expect(isDependencyCommit('chore(deps): update clapp')).toBe(true)
    expect(isDependencyCommit('chore(deps)')).toBe(true)
    expect(isDependencyCommit('fix(deps): repair lockfile')).toBe(false)
  })

  it('requires a dependency manifest or Bun lock change', () => {
    expect(hasDependencyStateChange(['package.json'])).toBe(true)
    expect(hasDependencyStateChange(['storage/framework/core/buddy/package.json'])).toBe(true)
    expect(hasDependencyStateChange(['config/deps.ts'])).toBe(true)
    expect(hasDependencyStateChange(['bun.lock'])).toBe(true)
    expect(hasDependencyStateChange(['CHANGELOG.md'])).toBe(false)
    expect(hasDependencyStateChange([])).toBe(false)
  })
})
