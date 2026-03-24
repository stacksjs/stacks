import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

describe('development module', () => {
  const basePath = join(import.meta.dir, '..')

  test('package.json exists', () => {
    expect(existsSync(join(basePath, 'package.json'))).toBe(true)
  })

  test('index.ts entry point exists', () => {
    expect(existsSync(join(basePath, 'index.ts'))).toBe(true)
  })

  test('module exports an empty object (stub)', async () => {
    const mod = await import('../index')
    // The module exports nothing (export {})
    expect(mod).toBeDefined()
    expect(typeof mod).toBe('object')
  })

  test('module has no named exports', async () => {
    const mod = await import('../index')
    // Only 'default' or Symbol keys may exist on the module namespace
    const namedExports = Object.keys(mod).filter(k => k !== '__esModule')
    expect(namedExports.length).toBe(0)
  })
})
