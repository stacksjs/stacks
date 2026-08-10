/**
 * stacksjs/stacks#2282 item 2 — retry backoff had no randomisation.
 *
 * A provider going down for a minute fails N jobs at once, `backoff[0]` sends
 * all N back at once, and they fail together again. The herd never breaks up,
 * and each wave hits the recovering dependency harder than the last.
 *
 * `applyRetryJitter` takes its randomness as an argument precisely so this can
 * be asserted rather than sampled: every case below is deterministic.
 */
import { describe, expect, it } from 'bun:test'
import { applyRetryJitter } from '../src/worker'

/** A `random` that walks a fixed sequence, so a "spread" is checkable. */
function sequence(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('retry jitter (#2282 item 2)', () => {
  it('never retries EARLIER than the configured backoff', () => {
    // The property that matters. `backoff` is often a rate-limit
    // accommodation, so classic full jitter over [0, delay] would be a
    // behaviour change with a real failure mode.
    for (const r of [0, 0.01, 0.5, 0.99, 1]) {
      expect(applyRetryJitter(60, 0.2, () => r)).toBeGreaterThanOrEqual(60)
    }
  })

  it('stays within the configured window above it', () => {
    // ratio 0.2 on 60s => 60..72
    expect(applyRetryJitter(60, 0.2, () => 0)).toBe(60)
    expect(applyRetryJitter(60, 0.2, () => 1)).toBe(72)
    expect(applyRetryJitter(60, 0.2, () => 0.5)).toBe(66)
  })

  it('actually separates a herd that shared one delay', () => {
    const random = sequence([0, 0.25, 0.5, 0.75, 1])
    const herd = Array.from({ length: 5 }, () => applyRetryJitter(40, 0.5, random))

    // The point of the change: five jobs that would all have come back at 40s
    // now come back at five different times.
    expect(new Set(herd).size).toBe(5)
    expect(Math.min(...herd)).toBe(40)
    expect(Math.max(...herd)).toBe(60)
  })

  it('leaves an explicit immediate retry immediate', () => {
    expect(applyRetryJitter(0, 0.2, () => 1)).toBe(0)
  })

  it('is a no-op when spreading is disabled', () => {
    expect(applyRetryJitter(30, 0, () => 1)).toBe(30)
  })

  it('returns whole seconds, since available_at is a unix timestamp', () => {
    for (const r of [0.111, 0.333, 0.777]) {
      const out = applyRetryJitter(37, 0.3, () => r)
      expect(Number.isInteger(out)).toBe(true)
    }
  })

  it('does not turn a negative or non-finite delay into a retry storm', () => {
    // The clamp upstream should prevent these, but the spread must not be the
    // thing that resurrects them.
    expect(applyRetryJitter(-5, 0.2, () => 1)).toBe(-5)
    expect(applyRetryJitter(Number.NaN, 0.2, () => 1)).toBeNaN()
  })
})
