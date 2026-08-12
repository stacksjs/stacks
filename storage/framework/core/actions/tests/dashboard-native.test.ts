import { describe, expect, it } from 'bun:test'
import { resolveDashboardCraftExecutable } from '../src/dev/dashboard-native'

describe('dashboard native Craft resolution', () => {
  it('skips resolution only through the explicit headless flag', () => {
    let called = false
    const result = resolveDashboardCraftExecutable(() => {
      called = true
      return 'craft'
    }, { disabled: true })

    expect(result).toBeUndefined()
    expect(called).toBe(false)
  })

  it('passes an explicit development binary through the Craft resolver', () => {
    let received: string | undefined
    const result = resolveDashboardCraftExecutable((explicit) => {
      received = explicit
      return explicit || 'craft'
    }, { explicit: '/tmp/craft-native' })

    expect(received).toBe('/tmp/craft-native')
    expect(result).toBe('/tmp/craft-native')
  })

  it('resolves pantry Craft through PATH', () => {
    const result = resolveDashboardCraftExecutable(() => 'craft', {
      findOnPath: () => '/pantry/bin/craft',
    })
    expect(result).toBe('/pantry/bin/craft')
  })

  it('returns undefined when pantry Craft is not installed', () => {
    const result = resolveDashboardCraftExecutable(() => 'craft', {
      findOnPath: () => null,
    })
    expect(result).toBeUndefined()
  })

  it('does not hide invalid explicit binary errors', () => {
    expect(() => resolveDashboardCraftExecutable(() => {
      throw new Error('CRAFT_BIN does not exist')
    }, { explicit: '/missing/craft' })).toThrow('CRAFT_BIN does not exist')
  })

  it('keeps the dashboard launcher on the canonical Craft contract', async () => {
    const source = await Bun.file(new URL('../src/dev/dashboard.ts', import.meta.url)).text()

    expect(source).toContain("import('craft-native')")
    expect(source).toContain('CRAFT_SDK_SRC')
    expect(source).toContain('STACKS_NO_NATIVE')
    expect(source).toContain('url: dashboardLocalUrl')
    expect(source).not.toContain('url: initialUrl')
    expect(source).not.toContain('/Code/Tools/craft')
    expect(source).not.toContain('/Documents/Projects/craft')
    expect(source).not.toContain('non-existent CRAFT_BIN')
  })
})
