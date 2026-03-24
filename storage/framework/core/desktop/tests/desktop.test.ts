import { describe, expect, test } from 'bun:test'

describe('desktop module', () => {
  test('openDevWindow is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.openDevWindow).toBe('function')
  })

  test('openDevWindow returns false (stub)', async () => {
    const { openDevWindow } = await import('../src/index')
    const result = await openDevWindow(3000)
    expect(result).toBe(false)
  })

  test('openDevWindow accepts port and options', async () => {
    const { openDevWindow } = await import('../src/index')
    const result = await openDevWindow(8080, {
      title: 'Dev',
      width: 1024,
      height: 768,
      darkMode: true,
      hotReload: true,
    })
    expect(result).toBe(false)
  })

  test('openDevWindow accepts empty options', async () => {
    const { openDevWindow } = await import('../src/index')
    const result = await openDevWindow(3000, {})
    expect(result).toBe(false)
  })

  test('Desktop interface shape is consistent with exports', async () => {
    // The module exports the function and interfaces only
    const mod = await import('../src/index')
    const exportKeys = Object.keys(mod)
    expect(exportKeys).toContain('openDevWindow')
  })
})
