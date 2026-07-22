import { describe, expect, it } from 'bun:test'
import { applyBumps, baseVersion, hasStacksDependency, lockstepPackages, standalonePackageUpdateCommand } from '../src/upgrade/packages'

describe('package-only buddy updates', () => {
  it('distinguishes Stacks apps from standalone packages', () => {
    expect(hasStacksDependency({ dependencies: { stacks: '^0.70.160' } })).toBe(true)
    expect(hasStacksDependency({ devDependencies: { stacks: '^0.70.160' } })).toBe(true)
    expect(hasStacksDependency({ devDependencies: { 'better-dx': '^0.2.19' } })).toBe(false)
  })

  it('refreshes only dependencies declared by the standalone package', () => {
    expect(standalonePackageUpdateCommand()).toBe('bun update')
  })
})

// stacksjs/stacks#2078: buddy upgrade must not drag independently-versioned
// @stacksjs/* packages (tlsx, ts-cloud) to the framework version — they don't
// publish it, so the resulting package.json fails `bun install`. The `stacks`
// meta declares each dep at the version it actually ships, so only the deps it
// pins AT the framework target are lockstep.
const META_DEPS = {
  '@stacksjs/tlsx': '^0.13.0', // independent line
  '@stacksjs/ts-cloud': '^0.7.49', // independent line
  '@stacksjs/registry': '^0.70.161', // lockstep
  '@stacksjs/server': '^0.70.161', // lockstep
  '@stacksjs/actions': '^0.70.161', // lockstep
  'better-dx': '^0.2.17', // independent, not @stacksjs
}
const TARGET = '0.70.161'

describe('framework version bump scoping (stacksjs/stacks#2078)', () => {
  it('strips range operators to a bare version', () => {
    expect(baseVersion('^0.70.161')).toBe('0.70.161')
    expect(baseVersion('~0.13.0')).toBe('0.13.0')
    expect(baseVersion('>=0.7.49')).toBe('0.7.49')
    expect(baseVersion('0.70.161')).toBe('0.70.161')
  })

  it('marks only stacks + @stacksjs deps pinned AT the target as lockstep', () => {
    const lockstep = lockstepPackages(META_DEPS, TARGET)
    expect([...lockstep].sort()).toEqual([
      '@stacksjs/actions',
      '@stacksjs/registry',
      '@stacksjs/server',
      'stacks',
    ])
    // The regression: independently-versioned packages must NOT be lockstep.
    expect(lockstep.has('@stacksjs/tlsx')).toBe(false)
    expect(lockstep.has('@stacksjs/ts-cloud')).toBe(false)
    expect(lockstep.has('better-dx')).toBe(false)
  })

  it('bumps lockstep packages to the target and leaves independent ones untouched', () => {
    const pkg = {
      dependencies: {
        'stacks': '^0.70.93',
        '@stacksjs/server': '^0.70.93',
        '@stacksjs/tlsx': '^0.13.11', // newer than the meta's ^0.13.0 — must not be touched
        '@stacksjs/ts-cloud': '^0.7.28',
        'ofetch': '^1.5.0', // unrelated
      },
    }
    const changes = applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))

    // Only the two lockstep packages moved.
    expect(changes.map(c => c.name).sort()).toEqual(['@stacksjs/server', 'stacks'])
    expect(pkg.dependencies.stacks).toBe('^0.70.161')
    expect(pkg.dependencies['@stacksjs/server']).toBe('^0.70.161')
    // The bug: these used to become ^0.70.161 (which does not exist).
    expect(pkg.dependencies['@stacksjs/tlsx']).toBe('^0.13.11')
    expect(pkg.dependencies['@stacksjs/ts-cloud']).toBe('^0.7.28')
    expect(pkg.dependencies.ofetch).toBe('^1.5.0')
  })

  it('preserves the app’s existing range prefix (caret, tilde, exact)', () => {
    const pkg = {
      dependencies: { stacks: '~0.70.93' },
      devDependencies: { '@stacksjs/server': '0.70.93', '@stacksjs/actions': '^0.70.93' },
    }
    applyBumps(pkg, TARGET, lockstepPackages(META_DEPS, TARGET))
    expect(pkg.dependencies.stacks).toBe('~0.70.161')
    expect(pkg.devDependencies['@stacksjs/server']).toBe('0.70.161') // exact pin stays exact
    expect(pkg.devDependencies['@stacksjs/actions']).toBe('^0.70.161')
  })
})
