import { describe, expect, test } from 'bun:test'
import { enforceQuota, evaluate, graceCeiling, HARD_SEND, QuotaExceededError, SOFT_INGEST } from '../src/meter'

describe('evaluate: soft ingest', () => {
  test('walks ok, warn, over and sampled at the documented thresholds', () => {
    // BugHQ's free allowance: 500 errors a month.
    expect(evaluate(399, 500, SOFT_INGEST)).toMatchObject({ state: 'ok', allowed: true })
    expect(evaluate(400, 500, SOFT_INGEST)).toMatchObject({ state: 'warn', allowed: true })
    expect(evaluate(499, 500, SOFT_INGEST)).toMatchObject({ state: 'warn', allowed: true })
    expect(evaluate(500, 500, SOFT_INGEST)).toMatchObject({ state: 'over', allowed: true })
    expect(evaluate(600, 500, SOFT_INGEST)).toMatchObject({ state: 'over', allowed: true, ceiling: 600 })
    expect(evaluate(601, 500, SOFT_INGEST)).toMatchObject({ state: 'sampled', allowed: false })
  })

  test('past 120% keeps exactly one event in ten, the same ones every time', () => {
    const kept = (): number[] => {
      const out: number[] = []
      for (let used = 601; used <= 700; used++) {
        if (evaluate(used, 500, 'soft-ingest').allowed)
          out.push(used)
      }
      return out
    }
    expect(kept()).toEqual([610, 620, 630, 640, 650, 660, 670, 680, 690, 700])
    expect(kept()).toEqual(kept())
  })

  test('an explicit sequence decides sampling when used counts only kept events', () => {
    expect(evaluate(601, 500, SOFT_INGEST, 9)).toMatchObject({ state: 'sampled', allowed: false })
    expect(evaluate(601, 500, SOFT_INGEST, 10)).toMatchObject({ state: 'sampled', allowed: true })
  })

  test('never refuses an unlimited meter and treats junk as zero', () => {
    expect(evaluate(10_000_000, null)).toEqual({ state: 'ok', allowed: true, used: 10_000_000, limit: null, ceiling: null })
    expect(evaluate(Number.NaN, 500)).toMatchObject({ state: 'ok', used: 0 })
    expect(evaluate(-5, 500)).toMatchObject({ state: 'ok', used: 0 })
  })

  test('computes thresholds in integers', () => {
    // 10,000 log lines, 1,000 pageviews: no 11999.999 ceilings.
    expect(graceCeiling(10_000, SOFT_INGEST)).toBe(12_000)
    expect(graceCeiling(1_000, 'soft-ingest')).toBe(1_200)
    expect(graceCeiling(3, SOFT_INGEST)).toBe(3)
    expect(graceCeiling(null, SOFT_INGEST)).toBeNull()
  })
})

describe('evaluate: hard send', () => {
  test('allows a 20% grace, then refuses', () => {
    // CommsHQ's free allowance: 100 emails a month.
    expect(evaluate(79, 100, HARD_SEND)).toMatchObject({ state: 'ok', allowed: true })
    expect(evaluate(80, 100, HARD_SEND)).toMatchObject({ state: 'warn', allowed: true })
    expect(evaluate(100, 100, HARD_SEND)).toMatchObject({ state: 'over', allowed: true })
    expect(evaluate(120, 100, HARD_SEND)).toMatchObject({ state: 'over', allowed: true })
    expect(evaluate(121, 100, 'hard-send')).toMatchObject({ state: 'over', allowed: false })
  })

  test('a zero allowance refuses the first unit', () => {
    // SMS is paid only.
    expect(evaluate(1, 0, HARD_SEND)).toMatchObject({ state: 'over', allowed: false })
  })

  test('enforceQuota throws a typed error carrying what the caller needs to explain it', () => {
    expect(enforceQuota('emails', 120, 100).allowed).toBe(true)
    let caught: unknown
    try {
      enforceQuota('emails', 121, 100, { upgradeUrl: 'https://commshq.test/pricing' })
    }
    catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(QuotaExceededError)
    expect((caught as QuotaExceededError).toJSON()).toEqual({
      error: 'quota_exceeded',
      meter: 'emails',
      used: 121,
      limit: 100,
      upgradeUrl: 'https://commshq.test/pricing',
    })
  })
})
