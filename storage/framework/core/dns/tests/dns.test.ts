import { describe, expect, test } from 'bun:test'

describe('DNS Module Exports', () => {
  test('dns index re-exports AWS driver functions', async () => {
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
  })

  test('deleteHostedZone function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.deleteHostedZone).toBe('function')
  })

  test('createHostedZone function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.createHostedZone).toBe('function')
  })

  test('deleteHostedZoneRecords function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.deleteHostedZoneRecords).toBe('function')
  })

  test('findHostedZone function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.findHostedZone).toBe('function')
  })

  test('getNameservers function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.getNameservers).toBe('function')
  })

  test('getHostedZoneNameservers function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.getHostedZoneNameservers).toBe('function')
  })

  test('updateNameservers function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.updateNameservers).toBe('function')
  })

  test('hasUserDomainBeenAddedToCloud function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.hasUserDomainBeenAddedToCloud).toBe('function')
  })

  test('addDomain function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.addDomain).toBe('function')
  })

  test('writeNameserversToConfig function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.writeNameserversToConfig).toBe('function')
  })
})

describe('DNS AWS Driver Behavior', () => {
  test('getNameservers returns empty array for undefined domain', async () => {
    const { getNameservers } = await import('../src/drivers/aws')
    const result = await getNameservers(undefined)
    expect(result).toEqual([])
  })

  test('getNameservers returns empty array for empty domain', async () => {
    const { getNameservers } = await import('../src/drivers/aws')
    const result = await getNameservers('')
    expect(result).toEqual([])
  })
})
