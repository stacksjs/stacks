import { describe, expect, it } from 'bun:test'
import { shouldSkipAppKeyCheck } from '../src/project-setup'

describe('Buddy project setup guards', () => {
  it('runs documentation tools without creating an application key', () => {
    expect(shouldSkipAppKeyCheck('docs:native-skills')).toBe(true)
    expect(shouldSkipAppKeyCheck('docs:native-skills:check')).toBe(true)
    expect(shouldSkipAppKeyCheck('docs:artifacts')).toBe(true)
  })

  it('allows upgrades in package-only and partially initialized projects', () => {
    expect(shouldSkipAppKeyCheck('upgrade')).toBe(true)
    expect(shouldSkipAppKeyCheck('update')).toBe(true)
    expect(shouldSkipAppKeyCheck('upgrade:dependencies')).toBe(true)
  })

  it('retains initialization for commands that require an application', () => {
    expect(shouldSkipAppKeyCheck('dev')).toBe(false)
  })
})
