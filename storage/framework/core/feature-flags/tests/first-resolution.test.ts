import { describe, expect, it } from 'bun:test'
import { MemoryFeatureFlagDriver } from '../src/drivers/memory'
import { createFeatureFlags } from '../src/manager'

// Two processes share one store. Each finds nothing stored for a scope and
// runs its resolver; the value both keep must be the one stored first, or
// the first request's answer changes on the next one.
describe('a first resolution racing another process', () => {
  it('keeps the value stored first, in both processes', async () => {
    const store = new MemoryFeatureFlagDriver()
    let arrived = 0
    let release!: () => void
    const bothResolving = new Promise<void>((resolve) => { release = resolve })
    const resolverReturning = (value: string, delay: number) => async () => {
      if (++arrived === 2) release()
      await bothResolving
      await Bun.sleep(delay)
      return value
    }

    const first = createFeatureFlags({ driver: store })
    const second = createFeatureFlags({ driver: store })
    first.define('layout', resolverReturning('compact', 0))
    second.define('layout', resolverReturning('visual', 5))

    const [a, b] = await Promise.all([first.value('layout', 7), second.value('layout', 7)])
    expect(a).toBe('compact')
    expect(b).toBe('compact')
    expect(await first.value('layout', 7)).toBe('compact')
    expect(await store.get('layout', 'number:7')).toBe('compact')
  })

  it('still overwrites on activate()', async () => {
    const store = new MemoryFeatureFlagDriver()
    const flags = createFeatureFlags({ driver: store })
    flags.define('layout', () => 'compact')
    expect(await flags.value('layout', 7)).toBe('compact')
    await flags.activate('layout', 'visual', 7)
    expect(await flags.value('layout', 7)).toBe('visual')
  })
})
