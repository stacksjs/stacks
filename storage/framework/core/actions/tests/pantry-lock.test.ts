import { describe, expect, it } from 'bun:test'
import { pantryLockViolations } from '../src/pantry-lock'

/**
 * The release guard for `pantry.lock` (stacksjs/stacks#2843).
 *
 * The two cases that actually happened are the first two tests. Everything
 * after them is a false positive this check must not produce, because a
 * release command that cries wolf gets ignored and the loop resumes.
 */

const sound = {
  version: '1.0.0',
  lockfileVersion: 2,
  workspaces: {
    '': {
      name: 'stacks',
      dependencies: { pickier: '^0.1.65', stacks: 'workspace:*' },
      system: {
        'bun.sh': '1.4.2',
        'curl.se': '^8.22.0',
        'git-scm.org': '^2.47.0',
        'sqlite.org': '^3.47.2',
      },
    },
    'storage/framework/core/mobile': {
      name: '@stacksjs/mobile',
      dependencies: { 'craft-native': '>=0.0.103' },
    },
  },
  packages: {
    'craft-native@0.0.105': { name: 'craft-native', version: '0.0.105' },
    'pickier@0.1.65': { name: 'pickier', version: '0.1.65' },
  },
}

const lockOf = (value: unknown) => JSON.stringify(value)
const committed = lockOf(sound)
const clone = () => JSON.parse(committed) as typeof sound

describe('pantryLockViolations', () => {
  it('passes a lock that satisfies its own ranges', () => {
    expect(pantryLockViolations(committed, committed)).toEqual([])
  })

  it('rejects a pin that no longer satisfies a range the lock itself declares', () => {
    // What five releases in a row committed: craft-native walked back to
    // 0.0.92 while the workspace still requires >=0.0.103, so an install must
    // re-resolve it and `compile` goes red on a commit nobody will connect to
    // the release that caused it.
    const regressed = clone()
    regressed.packages = {
      ...regressed.packages,
      'craft-native@0.0.92': { name: 'craft-native', version: '0.0.92' },
    }
    delete (regressed.packages as Record<string, unknown>)['craft-native@0.0.105']

    const problems = pantryLockViolations(lockOf(regressed), committed)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('craft-native is pinned at 0.0.92')
    expect(problems[0]).toContain('">=0.0.103"')
    expect(problems[0]).toContain('storage/framework/core/mobile')
  })

  it('rejects a lock whose root system block was dropped', () => {
    // The macOS signature. This one does not fail a job, it fails `Setup
    // Pantry` before any job runs, so the error has to name the pins.
    const stripped = clone()
    delete (stripped.workspaces[''] as Record<string, unknown>).system

    const problems = pantryLockViolations(lockOf(stripped), committed)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('bun.sh')
    expect(problems[0]).toContain('sqlite.org')
  })

  it('names every problem at once rather than the first', () => {
    const broken = clone()
    broken.packages = { 'craft-native@0.0.92': { name: 'craft-native', version: '0.0.92' } }
    delete (broken.workspaces[''] as Record<string, unknown>).system

    expect(pantryLockViolations(lockOf(broken), committed)).toHaveLength(2)
  })

  it('reports a single lost system pin without demanding the whole block', () => {
    const partial = clone()
    delete (partial.workspaces[''].system as Record<string, unknown>)['bun.sh']

    const problems = pantryLockViolations(lockOf(partial), committed)
    expect(problems).toEqual(['the root "system" block lost its "bun.sh" pin'])
  })

  it('ignores ranges that name a source rather than a version', () => {
    // `stacks: workspace:*` resolves to whatever is on disk. Comparing it
    // against a version would fail every correct lock in the repository.
    const withWorkspaceDep = clone()
    withWorkspaceDep.packages = {
      ...withWorkspaceDep.packages,
      'stacks@0.75.37': { name: 'stacks', version: '0.75.37' },
    }

    expect(pantryLockViolations(lockOf(withWorkspaceDep), committed)).toEqual([])
  })

  it('splits scoped package keys on the last @, not the first', () => {
    const scoped = clone()
    scoped.workspaces['storage/framework/core/mobile'].dependencies = { '@stacksjs/actions': '^0.75.37' }
    scoped.packages = { '@stacksjs/actions@0.75.37': { name: '@stacksjs/actions', version: '0.75.37' } }

    expect(pantryLockViolations(lockOf(scoped), committed)).toEqual([])
  })

  it('accepts a name resolved more than once when one version matches', () => {
    // Two workspaces needing incompatible versions is legal. Requiring every
    // resolution to match would reject a correct lock.
    const duplicated = clone()
    duplicated.packages = {
      ...duplicated.packages,
      'craft-native@0.0.92': { name: 'craft-native', version: '0.0.92' },
    }

    expect(pantryLockViolations(lockOf(duplicated), committed)).toEqual([])
  })

  it('stays silent about a declared dependency the lock never pinned', () => {
    const unpinned = clone()
    unpinned.workspaces['storage/framework/core/mobile'].dependencies = { 'not-in-the-lock': '^1.0.0' }

    expect(pantryLockViolations(lockOf(unpinned), committed)).toEqual([])
  })

  it('does not require a system block when the committed lock had none', () => {
    const neverHadOne = clone()
    delete (neverHadOne.workspaces[''] as Record<string, unknown>).system

    expect(pantryLockViolations(lockOf(neverHadOne), lockOf(neverHadOne))).toEqual([])
  })

  it('reports unparseable JSON instead of throwing', () => {
    const problems = pantryLockViolations('{ this is not json', committed)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('not valid JSON')
  })

  it('tolerates an unparseable baseline, judging only the new file', () => {
    expect(pantryLockViolations(committed, '{ truncated')).toEqual([])
  })
})
