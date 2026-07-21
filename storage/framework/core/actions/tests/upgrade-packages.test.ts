import { describe, expect, it } from 'bun:test'
import { hasStacksDependency, standalonePackageUpdateCommand } from '../src/upgrade/packages'

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
