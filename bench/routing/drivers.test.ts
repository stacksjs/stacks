import { describe, expect, it } from 'bun:test'
import { ohaArgs } from './drivers'

describe('oha command', () => {
  it('applies one global fixed request rate with latency correction', () => {
    expect(ohaArgs({
      url: 'http://127.0.0.1:39400/bench/json',
      method: 'GET',
      headers: {},
      connections: 64,
      warmupSeconds: 0,
      durationSeconds: 60,
      requestRate: 40_000,
    }, 60)).toEqual([
      'oha', '-z', '60s', '-c', '64', '-q', '40000', '--latency-correction',
      '--wait-ongoing-requests-after-deadline', '--no-tui', '--output-format', 'json',
      'http://127.0.0.1:39400/bench/json',
    ])
  })
})
