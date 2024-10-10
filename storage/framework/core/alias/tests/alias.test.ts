import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { alias } from '../src/index'

describe('@stacksjs/alias', () => {
  it('should have valid paths for all aliases', () => {
    Object.entries(alias).forEach(([key, value]) => {
      const filePath = value.replace('src/index.ts', '').replace('*', '')

      it(`should have a valid path for ${key}`, () => {
        expect(fs.existsSync(path.resolve(filePath))).toBe(true)
      })
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

  it('should have all aliases starting with "@stacksjs/" or "stacks/" or "~/" or "framework/" or be "stacks"', () => {
    const validPrefixes = ['@stacksjs/', 'stacks/', '~/', 'framework/']
    Object.keys(alias).forEach((key) => {
      expect(validPrefixes.some(prefix => key.startsWith(prefix) || key === 'stacks')).toBe(true)
    })
  })

  it('should have consistent naming conventions', () => {
    Object.keys(alias).forEach((key) => {
      expect(key).toMatch(/^(@stacksjs\/|stacks\/|~\/|framework\/)?[a-z-]+(\/[a-z-]+)*(\*)?$/)
    })
  })

  it('should have the expected number of total aliases', () => {
    expect(Object.keys(alias).length).toBe(250)
  })
})
