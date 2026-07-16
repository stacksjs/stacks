import { describe, expect, it } from 'bun:test'
import { MemoryFeatureFlagDriver } from '../src/drivers/memory'

describe('MemoryFeatureFlagDriver', () => {
  it('stores independent values per scope', async () => {
    const driver = new MemoryFeatureFlagDriver()
    await driver.set('checkout', 'user:1', true)
    await driver.set('checkout', 'user:2', false)
    expect(await driver.get('checkout', 'user:1')).toBe(true)
    expect(await driver.get('checkout', 'user:2')).toBe(false)
    expect(await driver.get('missing', 'user:1')).toBeUndefined()
  })

  it('clones structured values on writes and reads', async () => {
    const driver = new MemoryFeatureFlagDriver()
    const value = { variant: 'visual', options: { density: 2 } }
    await driver.set('search', 'global', value)
    value.options.density = 9

    const first = await driver.get('search', 'global') as typeof value
    first.options.density = 7
    expect(await driver.get('search', 'global')).toEqual({ variant: 'visual', options: { density: 2 } })
  })

  it('deletes one scope, one flag across scopes, or everything', async () => {
    const driver = new MemoryFeatureFlagDriver()
    await driver.set('a', 'one', true)
    await driver.set('a', 'two', true)
    await driver.set('b', 'one', true)

    await driver.delete('a', 'one')
    expect(await driver.stored('one')).toEqual({ b: true })

    await driver.deleteForAllScopes(['a'])
    expect(await driver.stored('two')).toEqual({})

    await driver.clear()
    expect(await driver.stored('one')).toEqual({})
  })
})
