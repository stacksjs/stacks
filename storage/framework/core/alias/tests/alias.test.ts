import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
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
      expect(key).toMatch(/^(@stacksjs\/|stacks\/|~\/|framework\/|@\/)?[a-z\d.*-]*(\/[a-z\d.*-]+)*(\*)?$/)
    })
  })

  /**
   * The map is 350+ entries of shape-checked strings, and every check above
   * passes just as happily on a path to nothing.
   *
   * Six entries pointed at nothing: `@stacksjs/email`, `/push` and `/sms` were
   * still resolved through `core/notifications/<name>` after all three were
   * promoted to top-level packages, `@stacksjs/dns` through `core/domains`,
   * `@stacksjs/development` through a `src` directory it does not have, and
   * `~/config/docs` into the docs PACKAGE rather than `config/docs.ts`.
   *
   * None of them failed anything, because nothing in this repository imports
   * the map - it is published for apps and bundlers to consume, so a stale
   * entry surfaces as a resolution error in someone else's project.
   */
  it('resolves every alias to something that exists on disk', () => {
    const dangling = Object.entries(alias)
      .filter(([key]) => !key.includes('*'))
      .filter(([, value]) => !existsSync(value))

    expect(Object.fromEntries(dangling)).toEqual({})
  })

  it('resolves every wildcard alias to a directory that exists', () => {
    // `foo/src/*` can only resolve if `foo/src` is there.
    const dangling = Object.entries(alias)
      .filter(([key]) => key.includes('*'))
      .map(([key, value]) => [key, value.replace(/\*.*$/, '')] as const)
      .filter(([, base]) => !existsSync(base))

    expect(Object.fromEntries(dangling)).toEqual({})
  })

  it('should map a substantial set of aliases', () => {
    // A lower bound, not an exact count: every new package adds an entry, and
    // pinning the exact number only ever produced a failure that was fixed by
    // typing in the new total. What matters is that the map is populated.
    expect(Object.keys(alias).length).toBeGreaterThan(200)
  })
})
