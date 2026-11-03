import { expect, test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
import { calculateDelay, retry } from '../src/utils/retry'

test('retry rejects invalid budgets and timing options before invoking work', async () => {
  let calls = 0
  for (const retries of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(retry(async () => ++calls, { retries })).rejects.toThrow(RangeError)
  }
  for (const invalid of [NaN, Infinity, -1]) {
    await expect(retry(async () => ++calls, { initialDelay: invalid })).rejects.toThrow(RangeError)
    await expect(retry(async () => ++calls, { backoffFactor: invalid })).rejects.toThrow(RangeError)
  }
  expect(calls).toBe(0)
})

test('retry respects zero/default budgets and preserves the final failure', async () => {
  const failure = new Error('transient')
  let calls = 0
  const fail = async () => { calls++; throw failure }
  await expect(retry(fail, { retries: 0 })).rejects.toBe(failure)
  expect(calls).toBe(1)
  calls = 0
  await expect(retry(fail, { initialDelay: 0, jitter: false })).rejects.toBe(failure)
  expect(calls).toBe(4)
  calls = 0
  expect(await retry(async () => { if (++calls < 3) throw failure; return 42 }, { initialDelay: 0 })).toBe(42)
  expect(calls).toBe(3)
})

test('exponential delays remain finite and within platform timer limits', () => {
  expect(calculateDelay(2, 100, 2, false)).toBe(400)
  expect(calculateDelay(2, 1e-310, 1e155, false)).toBeCloseTo(1, 10)
  expect(calculateDelay(40, 1000, 2, false)).toBe(2147483647)
  expect(calculateDelay(1000, Number.MAX_VALUE, 2, true)).toBe(2147483647)
  expect(calculateDelay(1000, 0, 2, true)).toBe(0)
  for (const attempt of [NaN, Infinity, -1, 1.5]) expect(() => calculateDelay(attempt, 1, 2)).toThrow(RangeError)
})

test('real timers do not turn a long backoff into rapid retries', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/retry-long-delay.ts`, { envFile: false, preload: [], timeoutMs: 5000 }), 'long retry delay OK')
}, 10_000)
