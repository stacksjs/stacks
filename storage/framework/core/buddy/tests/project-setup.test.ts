import { describe, expect, it } from 'bun:test'
import { shouldSkipAppKeyCheck } from '../src/project-setup'

describe('Buddy project setup guards', () => {
  it('allows upgrades in package-only and partially initialized projects', () => {
    expect(shouldSkipAppKeyCheck('upgrade')).toBe(true)
    expect(shouldSkipAppKeyCheck('update')).toBe(true)
    expect(shouldSkipAppKeyCheck('upgrade:dependencies')).toBe(true)
  })

  it('retains initialization for commands that require an application', () => {
    expect(shouldSkipAppKeyCheck('dev')).toBe(false)
  })
})
