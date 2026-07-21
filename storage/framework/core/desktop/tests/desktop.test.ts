import { describe, expect, test } from 'bun:test'

describe('desktop module', () => {
  test('openDevWindow is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.openDevWindow).toBe('function')
  })

  test('openDevWindow launches Craft with the pretty project URL', async () => {
    const { openDevWindow } = await import('../src/index')
    let command: string[] = []
    const result = await openDevWindow(3000, { url: 'https://example.test' }, (args) => {
      command = args
    })
    expect(result).toBe(true)
    expect(command).toContain('https://example.test')
    expect(command).toContain('--hot-reload')
  })

  test('openDevWindow accepts port and options', async () => {
    const { openDevWindow } = await import('../src/index')
    let command: string[] = []
    const result = await openDevWindow(8080, {
      url: 'localhost:8080',
      title: 'Dev',
      width: 1024,
      height: 768,
      darkMode: true,
      hotReload: true,
    }, (args) => {
      command = args
    })
    expect(result).toBe(true)
    expect(command).toEqual([
      'craft',
      'https://localhost:8080',
      '--title',
      'Dev',
      '--width',
      '1024',
      '--height',
      '768',
      '--hot-reload',
      '--dev-tools',
      '--dark-mode',
    ])
  })

  test('uses the Stacks pretty URL as the zero-config default', async () => {
    const { resolveDevWindowUrl } = await import('../src/index')
    const previousAppUrl = process.env.APP_URL
    delete process.env.APP_URL
    expect(resolveDevWindowUrl(3000)).toBe('https://stacks.test')
    if (previousAppUrl) process.env.APP_URL = previousAppUrl
  })

  test('rejects invalid ports before launching Craft', async () => {
    const { resolveDevWindowUrl } = await import('../src/index')
    expect(() => resolveDevWindowUrl(0)).toThrow(RangeError)
  })

  test('Desktop interface shape is consistent with exports', async () => {
    // The module exports the function and interfaces only
    const mod = await import('../src/index')
    const exportKeys = Object.keys(mod)
    expect(exportKeys).toContain('openDevWindow')
    expect(exportKeys).toContain('craftDevCommand')
  })
})
