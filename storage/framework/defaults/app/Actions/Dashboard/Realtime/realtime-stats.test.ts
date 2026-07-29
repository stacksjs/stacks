import { describe, expect, test } from 'bun:test'
import { buildRealtimeStats } from './realtime-stats'

describe('realtime dashboard statistics', () => {
  test('aggregates recorded websocket events without invented metrics', () => {
    const result = buildRealtimeStats([
      { id: '1', type: 'success', socket: 'socket-a', details: 'Connected', time: 1_753_770_000_000, createdAt: '' },
      { id: '2', type: 'success', socket: 'socket-a', details: 'Message', time: 1_753_770_001_000, createdAt: '' },
      { id: '3', type: 'error', socket: 'socket-b', details: 'Closed', time: 1_753_770_002_000, createdAt: '' },
    ])

    expect(result.overview).toEqual({
      recordedEvents: 3,
      uniqueSockets: 2,
      successes: 2,
      errors: 1,
      disconnections: 0,
      successRate: 66.7,
    })
    expect(result.events[0]?.id).toBe('3')
  })

  test('normalizes timestamps stored in seconds', () => {
    const result = buildRealtimeStats([
      { id: '1', type: 'success', socket: 'socket-a', details: 'Connected', time: 1_753_770_000, createdAt: '' },
    ])

    expect(result.events[0]?.occurredAt).toBe('2025-07-29T06:20:00.000Z')
  })
})
