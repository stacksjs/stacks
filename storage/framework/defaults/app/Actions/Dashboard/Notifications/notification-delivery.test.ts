import { describe, expect, it } from 'bun:test'
import { parseDeliveryMetadata } from './notification-delivery'

describe('dashboard notification delivery metadata', () => {
  it('parses persisted metadata objects', () => {
    expect(parseDeliveryMetadata('{"provider":"log"}')).toEqual({ provider: 'log' })
    expect(parseDeliveryMetadata({ provider: 'ses' })).toEqual({ provider: 'ses' })
    expect(parseDeliveryMetadata(null)).toEqual({})
  })

  it('reports corrupt or non-object metadata', () => {
    expect(() => parseDeliveryMetadata('{', 'delivery 4 metadata'))
      .toThrow('Could not parse delivery 4 metadata')
    expect(() => parseDeliveryMetadata('[]', 'delivery 4 metadata'))
      .toThrow('delivery 4 metadata must be a JSON object')
  })
})
