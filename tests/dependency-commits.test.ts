import { describe, expect, it } from 'bun:test'
import { hasDependencyStateChange, isDependencyCommit } from '../.github/scripts/check-dependency-commits'

describe('dependency commit integrity', () => {
  it('recognizes dependency commit subjects', () => {
    expect(isDependencyCommit('chore(deps): update clapp')).toBe(true)
    expect(isDependencyCommit('chore(deps)')).toBe(true)
    expect(isDependencyCommit('fix(deps): repair lockfile')).toBe(false)
  })

  it('requires a dependency manifest or dependency-manager lock change', () => {
    expect(hasDependencyStateChange(['package.json'])).toBe(true)
    expect(hasDependencyStateChange(['storage/framework/core/buddy/package.json'])).toBe(true)
    expect(hasDependencyStateChange(['config/deps.ts'])).toBe(true)
    expect(hasDependencyStateChange(['bun.lock'])).toBe(true)
    expect(hasDependencyStateChange(['pantry.lock'])).toBe(true)
    expect(hasDependencyStateChange(['CHANGELOG.md'])).toBe(false)
  })

  /**
   * Which bot proposes dependency changes is dependency work too, and a commit
   * that says so should not have to be relabeled `chore(config)` to pass. The
   * set is named files rather than a directory, so this stays a guard: a
   * `chore(deps)` commit touching only source or docs is still mislabeled.
   */
  it('accepts the dependency-bot configuration (#2574)', () => {
    expect(hasDependencyStateChange(['.github/renovate.json'])).toBe(true)
    expect(hasDependencyStateChange(['.github/dependabot.yml'])).toBe(true)
    expect(hasDependencyStateChange(['.github/workflows/buddy-bot.yml'])).toBe(true)
    expect(hasDependencyStateChange(['config/buddy-bot.ts'])).toBe(true)
  })

  it('accepts the same policy files inside the app template', () => {
    expect(hasDependencyStateChange(['storage/framework/defaults/scaffold/config/buddy-bot.ts'])).toBe(true)
    expect(hasDependencyStateChange(['storage/framework/defaults/vcs/github/workflows/buddy-bot.yml'])).toBe(true)
    expect(hasDependencyStateChange(['storage/framework/defaults/vcs/github/renovate.json'])).toBe(true)
  })

  it('still rejects a chore(deps) commit that touches neither', () => {
    expect(hasDependencyStateChange(['.github/workflows/ci.yml'])).toBe(false)
    expect(hasDependencyStateChange(['storage/framework/core/storage/src/index.ts'])).toBe(false)
    expect(hasDependencyStateChange(['docs/packages/storage.md'])).toBe(false)
    expect(hasDependencyStateChange([])).toBe(false)
  })
})
