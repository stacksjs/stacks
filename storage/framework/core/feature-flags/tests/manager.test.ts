import { describe, expect, it } from 'bun:test'
import { FeatureNotDefinedError, InvalidFeatureValueError } from '../src/errors'
import { createFeatureFlags } from '../src/manager'

describe('FeatureFlagManager', () => {
  it('evaluates and persists literal definitions', async () => {
    const flags = createFeatureFlags()
    flags.define({ enabled: true, disabled: false, layout: 'compact', config: { density: 2 } })

    expect(await flags.active('enabled')).toBe(true)
    expect(await flags.inactive('disabled')).toBe(true)
    expect(await flags.value('layout')).toBe('compact')
    expect(await flags.value('config')).toEqual({ density: 2 })
  })

  it('passes the original scope and normalized context to resolvers', async () => {
    const flags = createFeatureFlags()
    const user = { id: 42, plan: 'pro' }
    flags.define<typeof user>('reports', (scope, context) => ({
      active: scope.plan === 'pro',
      key: context.scopeKey,
      name: context.name,
    }))

    expect(await flags.value('reports', user)).toEqual({
      active: true,
      key: 'model:Object:42',
      name: 'reports',
    })
  })

  it('evaluates a resolver once per scope and keeps values sticky', async () => {
    const flags = createFeatureFlags()
    let evaluations = 0
    flags.define('rollout', () => ++evaluations === 1)

    expect(await flags.value('rollout', 1)).toBe(true)
    expect(await flags.value('rollout', 1)).toBe(true)
    expect(await flags.value('rollout', 2)).toBe(false)
    expect(evaluations).toBe(2)
  })

  it('deduplicates concurrent resolver evaluation', async () => {
    const flags = createFeatureFlags()
    let evaluations = 0
    flags.define('slow', async () => {
      evaluations++
      await Bun.sleep(5)
      return 'ready'
    })

    const values = await Promise.all(Array.from({ length: 20 }, () => flags.value('slow', 'same')))
    expect(new Set(values)).toEqual(new Set(['ready']))
    expect(evaluations).toBe(1)
  })

  it('does not cache failed or invalid evaluations', async () => {
    const flags = createFeatureFlags()
    let attempts = 0
    flags.define('unstable', () => {
      attempts++
      if (attempts === 1) throw new Error('temporary')
      return true
    })

    await expect(flags.value('unstable')).rejects.toThrow('temporary')
    expect(await flags.value('unstable')).toBe(true)
    expect(attempts).toBe(2)

    flags.define('invalid', () => Number.NaN)
    await expect(flags.value('invalid')).rejects.toBeInstanceOf(InvalidFeatureValueError)
  })

  it('snapshots literal definitions and rejects invalid literals immediately', async () => {
    const flags = createFeatureFlags()
    const value = { density: 2 }
    flags.define('layout', value)
    value.density = 9
    expect(await flags.value('layout')).toEqual({ density: 2 })
    expect(() => flags.define('invalid-literal', Number.POSITIVE_INFINITY)).toThrow(InvalidFeatureValueError)
  })

  it('supports scoped activation, deactivation, and forgetting', async () => {
    const flags = createFeatureFlags()
    let defaultValue = false
    flags.define('checkout', () => defaultValue)
    const alice = flags.for({ id: 1, featureFlagType: 'User' })
    const bob = flags.for({ id: 2, featureFlagType: 'User' })

    await alice.activate('checkout')
    await bob.deactivate('checkout')
    expect(await alice.active('checkout')).toBe(true)
    expect(await bob.active('checkout')).toBe(false)

    defaultValue = true
    await bob.forget('checkout')
    expect(await bob.active('checkout')).toBe(true)
  })

  it('makes an explicit override win over an in-flight resolver', async () => {
    const flags = createFeatureFlags()
    flags.define('slow', async () => {
      await Bun.sleep(5)
      return false
    })

    const evaluation = flags.value('slow', 1)
    const activation = flags.activate('slow', true, 1)
    expect(await evaluation).toBe(false)
    await activation
    expect(await flags.value('slow', 1)).toBe(true)
  })

  it('returns false for unknown flags by default and can fail closed', async () => {
    const flags = createFeatureFlags()
    expect(await flags.value('unknown')).toBe(false)

    flags.missing('throw')
    await expect(flags.value('strict-unknown')).rejects.toBeInstanceOf(FeatureNotDefinedError)
  })

  it('supports bulk reads, all values, and explicit undefined flag overrides', async () => {
    const flags = createFeatureFlags()
    flags.define({ a: true, b: 'variant-b' })
    await flags.activate('manual', { source: 'operator' })

    expect(await flags.values(['a', 'b', 'a'])).toEqual({ a: true, b: 'variant-b' })
    expect(await flags.all()).toEqual({ manual: { source: 'operator' }, a: true, b: 'variant-b' })
  })

  it('purges selected flags across scopes and flushes all stored values', async () => {
    const flags = createFeatureFlags()
    let value = true
    flags.define({ a: () => value, b: () => value })
    await flags.value('a', 1)
    await flags.value('a', 2)
    await flags.value('b', 1)
    value = false

    await flags.purge('a')
    expect(await flags.value('a', 1)).toBe(false)
    expect(await flags.value('a', 2)).toBe(false)
    expect(await flags.value('b', 1)).toBe(true)

    await flags.flush()
    expect(await flags.value('b', 1)).toBe(false)
  })

  it('runs conditional callbacks and scoped facade bulk methods', async () => {
    const flags = createFeatureFlags()
    flags.define({ on: 'visual', off: false })
    const scoped = flags.for('tenant-a')

    expect(await scoped.when('on', value => `on:${value}`, () => 'off')).toBe('on:visual')
    expect(await scoped.unless('off', () => 'inactive', () => 'active')).toBe('inactive')
    expect(await scoped.values(['on', 'off'])).toEqual({ on: 'visual', off: false })
  })

  it('emits evaluation metadata and supports listener removal', async () => {
    const flags = createFeatureFlags()
    flags.define('observed', true)
    const events: string[] = []
    const unsubscribe = flags.onEvaluated(event => events.push(`${event.name}:${event.source}`))

    await flags.value('observed', 1)
    await flags.value('observed', 1)
    unsubscribe()
    await flags.value('observed', 2)
    expect(events).toEqual(['observed:resolver', 'observed:stored'])
  })

  it('does not let observational listener failures break evaluation', async () => {
    const flags = createFeatureFlags()
    flags.define('safe', true)
    flags.onEvaluated(() => {
      throw new Error('observer failed')
    })
    expect(await flags.value('safe')).toBe(true)
  })

  it('allows explicit activation after a failed in-flight evaluation', async () => {
    const flags = createFeatureFlags()
    flags.define('broken', async () => {
      await Bun.sleep(2)
      throw new Error('resolver failed')
    })
    const failed = flags.value('broken', 1)
    const activation = flags.activate('broken', true, 1)
    await expect(failed).rejects.toThrow('resolver failed')
    await activation
    expect(await flags.value('broken', 1)).toBe(true)
  })

  it('retries a transient driver factory failure', async () => {
    let attempts = 0
    const flags = createFeatureFlags({
      driver: async () => {
        attempts++
        if (attempts === 1) throw new Error('driver unavailable')
        const { MemoryFeatureFlagDriver } = await import('../src/drivers/memory')
        return new MemoryFeatureFlagDriver()
      },
    })
    flags.define('retry', true)
    await expect(flags.value('retry')).rejects.toThrow('driver unavailable')
    expect(await flags.value('retry')).toBe(true)
    expect(attempts).toBe(2)
  })

  it('handles prototype-like feature names safely', async () => {
    const flags = createFeatureFlags()
    flags.define({ __proto__: true, constructor: 'variant' })
    await flags.activate('__proto__', true)
    const all = await flags.all()
    expect(Object.hasOwn(all, '__proto__')).toBe(true)
    expect(all.__proto__).toBe(true)
    expect(all.constructor).toBe('variant')
  })

  it('validates names and definitions', () => {
    const flags = createFeatureFlags()
    expect(() => flags.define(' ', true)).toThrow(/non-empty/)
    expect(() => flags.define(' spaced ', true)).toThrow(/whitespace/)
    expect(() => flags.define('missing', undefined as never)).toThrow(/definition is required/)
    expect(() => flags.define('🚀'.repeat(100), true)).toThrow(/191 UTF-8 bytes/)
  })
})
