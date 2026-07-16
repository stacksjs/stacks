import { describe, expect, it } from 'bun:test'
import path from 'node:path'
import { alias } from '../src/index'

describe('@stacksjs/alias', () => {
  it('resolves feature flag package aliases', () => {
    expect(alias['@stacksjs/feature-flags']).toContain('core/feature-flags/src/index.ts')
    expect(alias['stacks/feature-flags']).toBe(alias['@stacksjs/feature-flags'])
    expect(alias['@stacksjs/feature-flags/*']).toContain('core/feature-flags/src/*')
  })

  it('should have non-empty path values for all aliases', () => {
    Object.entries(alias).forEach(([key, value]) => {
      expect(value.length).toBeGreaterThan(0)
      expect(path.isAbsolute(value) || value.includes('/')).toBe(true)
    })
  })

  it('should have expected duplicate values for @stacksjs/* and stacks/* aliases', () => {
    const values = Object.entries(alias)
    const stacksjsAliases = values.filter(([key]) => key.startsWith('@stacksjs/'))
    const stacksAliases = values.filter(([key]) => key.startsWith('stacks/'))

    expect(stacksjsAliases.length).toBe(stacksAliases.length)

    stacksjsAliases.forEach(([key, value]) => {
      const stacksKey = `stacks/${key.slice('@stacksjs/'.length)}`
      expect(alias[stacksKey]).toBe(value)
    })
  })

  it('should have all aliases starting with "@stacksjs/" or "stacks/" or "~/" or "framework/" or "@/" or be "stacks"', () => {
    const validPrefixes = ['@stacksjs/', 'stacks/', '~/', 'framework/', '@/']
    Object.keys(alias).forEach((key) => {
      expect(validPrefixes.some(prefix => key.startsWith(prefix)) || key === 'stacks').toBe(true)
    })
  })

  it('should have consistent naming conventions', () => {
    Object.keys(alias).forEach((key) => {
      expect(key).toMatch(/^(@stacksjs\/|stacks\/|~\/|framework\/|@\/)?[a-z.*-]*(\/[a-z.*-]+)*(\*)?$/)
    })
  })

  it('should have the expected number of total aliases', () => {
    expect(Object.keys(alias).length).toBe(250)
  })
})
