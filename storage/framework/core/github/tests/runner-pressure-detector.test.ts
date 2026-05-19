/**
 * Tests for the runner-pressure detector (stacksjs/stacks#1850).
 *
 * Pure-function tests — no DB, no notify, no network. Drives the
 * clock via `options.now` so the hysteresis transitions are
 * deterministic at the millisecond.
 */

import type { RunnerAlertState, RunnerSample } from '../src/runner-pressure-detector'
import { describe, expect, test } from 'bun:test'
import { detectRunnerPressure } from '../src/runner-pressure-detector'

const NOW = Date.parse('2026-05-20T12:00:00Z')

/**
 * Generate a sample series for one org. Newest sample is at `now`;
 * `count` samples spaced `intervalMs` apart marching backwards.
 *
 * Each sample's `queued` is supplied by `queuedAt(i)` where `i = 0`
 * is the oldest (window-start) sample.
 */
function seriesFor(
  org: string,
  count: number,
  intervalMs: number,
  queuedAt: (i: number) => number,
  now: number = NOW,
  running = 0,
  cap = 20,
): RunnerSample[] {
  const samples: RunnerSample[] = []
  for (let i = 0; i < count; i++) {
    const sampledAt = new Date(now - (count - 1 - i) * intervalMs).toISOString()
    samples.push({ org, running, queued: queuedAt(i), cap, sampledAt })
  }
  return samples
}

describe('detectRunnerPressure — fire path', () => {
  test('every sample in window above threshold + not alerting → fire', () => {
    // 10-minute window with 5 samples spaced 2.5 minutes apart, all
    // at queued=10 (> 8 threshold).
    const samples = seriesFor('org-a', 5, 150_000, () => 10)
    const result = detectRunnerPressure(samples, new Map(), {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(1)
    expect(result[0].org).toBe('org-a')
    expect(result[0].action).toBe('fire')
    expect(result[0].current.queued).toBe(10)
  })

  test('one sample inside window dips below threshold → no fire (mixed)', () => {
    const samples = seriesFor('org-a', 5, 150_000, i => (i === 2 ? 3 : 10))
    const result = detectRunnerPressure(samples, new Map(), {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(0)
  })

  test('insufficient sample history — span < windowMs → no fire', () => {
    // Only 2 samples, spaced 1 minute. Window requires 10 minutes
    // of sustained pressure; we don't have enough history yet.
    const samples = seriesFor('org-a', 2, 60_000, () => 10)
    const result = detectRunnerPressure(samples, new Map(), {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(0)
  })

  test('already alerting + still elevated → no fire (sticky alerting)', () => {
    const samples = seriesFor('org-a', 5, 150_000, () => 10)
    const states = new Map<string, RunnerAlertState>([
      ['org-a', { org: 'org-a', alerting: true, lastAlertedAt: '2026-05-20T11:30:00Z', lastClearedAt: null }],
    ])
    const result = detectRunnerPressure(samples, states, {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(0)
  })

  test('queued === threshold counts as pressure (>= not >)', () => {
    const samples = seriesFor('org-a', 5, 150_000, () => 8)
    const result = detectRunnerPressure(samples, new Map(), {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(1)
    expect(result[0].action).toBe('fire')
  })

  test('multiple orgs — each evaluated independently', () => {
    const aSamples = seriesFor('org-a', 5, 150_000, () => 10) // fire
    const bSamples = seriesFor('org-b', 5, 150_000, () => 2)  // calm
    const cSamples = seriesFor('org-c', 5, 150_000, i => (i === 2 ? 2 : 10)) // mixed → no fire
    const result = detectRunnerPressure(
      [...aSamples, ...bSamples, ...cSamples],
      new Map(),
      { queuedThreshold: 8, windowMinutes: 10, now: NOW },
    )
    expect(result.length).toBe(1)
    expect(result[0].org).toBe('org-a')
  })
})

describe('detectRunnerPressure — clear path (hysteresis)', () => {
  test('alerting + every sample below threshold → clear', () => {
    const samples = seriesFor('org-a', 5, 150_000, () => 2)
    const states = new Map<string, RunnerAlertState>([
      ['org-a', { org: 'org-a', alerting: true, lastAlertedAt: '2026-05-20T11:30:00Z', lastClearedAt: null }],
    ])
    const result = detectRunnerPressure(samples, states, {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(1)
    expect(result[0].action).toBe('clear')
  })

  test('alerting + mixed window → stay alerting (no clear)', () => {
    const samples = seriesFor('org-a', 5, 150_000, i => (i === 4 ? 2 : 10))
    const states = new Map<string, RunnerAlertState>([
      ['org-a', { org: 'org-a', alerting: true, lastAlertedAt: '2026-05-20T11:30:00Z', lastClearedAt: null }],
    ])
    const result = detectRunnerPressure(samples, states, {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(0)
  })

  test('not alerting + every sample below → no clear (already calm)', () => {
    const samples = seriesFor('org-a', 5, 150_000, () => 2)
    const states = new Map<string, RunnerAlertState>([
      ['org-a', { org: 'org-a', alerting: false, lastAlertedAt: null, lastClearedAt: null }],
    ])
    const result = detectRunnerPressure(samples, states, {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(0)
  })

  test('clear → fire requires a full clearing window first', () => {
    // Scenario: org just cleared at 11:45 (15m ago). Now queued is
    // back up to 10. We need a full 10m window of pressure to fire
    // again — and the most recent 10m includes the time during
    // which it was below threshold. So the detector sees a mixed
    // window and emits no action.
    const samples = [
      // 10 minutes ago: queue was at 2 (cleared moment).
      ...seriesFor('org-a', 1, 0, () => 2, NOW - 10 * 60_000),
      // Then queue rose back to 10 in the last 5 minutes.
      ...seriesFor('org-a', 3, 150_000, () => 10, NOW),
    ]
    const states = new Map<string, RunnerAlertState>([
      ['org-a', { org: 'org-a', alerting: false, lastAlertedAt: '2026-05-20T11:00:00Z', lastClearedAt: '2026-05-20T11:50:00Z' }],
    ])
    const result = detectRunnerPressure(samples, states, {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    // Mixed window (one low sample at -10m, three high samples) →
    // no action.
    expect(result.length).toBe(0)
  })
})

describe('detectRunnerPressure — edge cases', () => {
  test('no samples → no actions', () => {
    const result = detectRunnerPressure([], new Map(), {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(0)
  })

  test('samples outside the window are ignored', () => {
    // 5 samples spaced 5 minutes apart starting from 30 minutes ago
    // — every one of them lies outside the 10-minute lookback.
    const samples = [
      { org: 'org-a', running: 0, queued: 10, cap: 20, sampledAt: new Date(NOW - 30 * 60_000).toISOString() },
      { org: 'org-a', running: 0, queued: 10, cap: 20, sampledAt: new Date(NOW - 25 * 60_000).toISOString() },
      { org: 'org-a', running: 0, queued: 10, cap: 20, sampledAt: new Date(NOW - 20 * 60_000).toISOString() },
    ]
    const result = detectRunnerPressure(samples, new Map(), {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result.length).toBe(0)
  })

  test('reports sustainedMs accurately', () => {
    const samples = seriesFor('org-a', 5, 150_000, () => 10) // span = 4 * 2.5min = 10min
    const result = detectRunnerPressure(samples, new Map(), {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result[0].sustainedMs).toBe(10 * 60_000)
  })

  test('current carries the latest sample (newest in window)', () => {
    const samples = seriesFor('org-a', 5, 150_000, i => 10 + i, NOW, 3, 20)
    // i ranges 0..4 → queued = 10,11,12,13,14. current = i=4 (newest).
    const result = detectRunnerPressure(samples, new Map(), {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    expect(result[0].current.queued).toBe(14)
    expect(result[0].current.cap).toBe(20)
  })

  test('malformed sample timestamps are silently dropped', () => {
    const samples = [
      { org: 'org-a', running: 0, queued: 10, cap: 20, sampledAt: 'not-a-date' },
      ...seriesFor('org-a', 5, 150_000, () => 10),
    ]
    const result = detectRunnerPressure(samples, new Map(), {
      queuedThreshold: 8,
      windowMinutes: 10,
      now: NOW,
    })
    // The bad sample is ignored; the good window still fires.
    expect(result.length).toBe(1)
    expect(result[0].action).toBe('fire')
  })
})
