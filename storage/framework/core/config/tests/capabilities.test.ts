import { describe, expect, it } from 'bun:test'
import { assertCapabilityAvailable, capabilityDrivers, findCapability } from '../src/capabilities'

describe('capability registry', () => {
  it('resolves operational drivers', () => {
    expect(assertCapabilityAvailable('database', 'sqlite').status).toBe('supported')
    expect(capabilityDrivers('queue').map(driver => driver.name)).toContain('redis')
  })

  it('fails loudly for unknown and unsupported drivers', () => {
    expect(() => assertCapabilityAvailable('queue', 'typo')).toThrow('Unknown queue driver')
    expect(() => assertCapabilityAvailable('queue', 'sqs')).toThrow('is unsupported')
    expect(findCapability('database', 'dynamodb')?.status).toBe('unsupported')
  })
})
