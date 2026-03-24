import { describe, expect, test } from 'bun:test'

describe('ui module', () => {
  test('CssEngine is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.CssEngine).toBeDefined()
    expect(typeof mod.CssEngine).toBe('object')
  })

  test('ui config is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.ui).toBeDefined()
    expect(typeof mod.ui).toBe('object')
  })

  test('module has CssEngine and ui named exports', async () => {
    const mod = await import('../src/index')
    const keys = Object.keys(mod).filter(k => k !== '__esModule' && k !== 'default')
    expect(keys).toContain('CssEngine')
    expect(keys).toContain('ui')
  })
})
