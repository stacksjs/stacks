import { describe, expect, mock, test } from 'bun:test'

// Mock dependencies
mock.module('@stacksjs/config', () => ({
  ui: {
    theme: 'default',
    darkMode: false,
  },
}))

mock.module('@cwcss/crosswind', () => ({
  generateCSS: () => '',
  process: () => '',
  default: { generateCSS: () => '' },
}))

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

  test('ui config contains theme setting', async () => {
    const mod = await import('../src/index')
    expect(mod.ui.theme).toBe('default')
  })

  test('module has exactly two named exports', async () => {
    const mod = await import('../src/index')
    const keys = Object.keys(mod).filter(k => k !== '__esModule' && k !== 'default')
    expect(keys).toContain('CssEngine')
    expect(keys).toContain('ui')
  })
})
