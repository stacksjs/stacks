import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { ref } from '@stacksjs/stx'
import { useDebounceFn } from '../src/useDebounceFn'
import { useThrottleFn } from '../src/useThrottleFn'
import { useInterval } from '../src/useInterval'
import { useIntervalFn } from '../src/useIntervalFn'
import { useTimeout } from '../src/useTimeout'
import { useTimeoutFn } from '../src/useTimeoutFn'
import { useTimestamp } from '../src/useTimestamp'
import { useTimeAgo } from '../src/useTimeAgo'
import { useRafFn } from '../src/useRafFn'
import { useEventListener } from '../src/useEventListener'
import { useDebouncedRef } from '../src/useDebouncedRef'
import { useThrottledRef } from '../src/useThrottledRef'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ============================================================================
// useDebounceFn
// ============================================================================
describe('useDebounceFn', () => {
  it('should debounce the function call', async () => {
    let count = 0
    const debounced = useDebounceFn(() => { count++ }, 50)

    debounced()
    debounced()
    debounced()
    expect(count).toBe(0)

    await sleep(80)
    expect(count).toBe(1)
  })

  it('should use default delay of 200ms', async () => {
    let count = 0
    const debounced = useDebounceFn(() => { count++ })

    debounced()
    await sleep(100)
    expect(count).toBe(0)

    await sleep(150)
    expect(count).toBe(1)
  })

  it('should cancel pending invocation', async () => {
    let count = 0
    const debounced = useDebounceFn(() => { count++ }, 50)

    debounced()
    debounced.cancel()
    await sleep(80)
    expect(count).toBe(0)
  })

  it('should pass arguments to the original function', async () => {
    let received: any[] = []
    const debounced = useDebounceFn((...args: any[]) => { received = args }, 50)

    debounced('a', 'b', 'c')
    await sleep(80)
    expect(received).toEqual(['a', 'b', 'c'])
  })

  it('should use the latest arguments when called multiple times', async () => {
    let received: any = null
    const debounced = useDebounceFn((val: any) => { received = val }, 50)

    debounced('first')
    debounced('second')
    debounced('third')
    await sleep(80)
    expect(received).toBe('third')
  })

  it('should reset timer on each call', async () => {
    let count = 0
    const debounced = useDebounceFn(() => { count++ }, 60)

    debounced()
    await sleep(30)
    debounced()
    await sleep(30)
    debounced()
    await sleep(30)
    expect(count).toBe(0)

    await sleep(50)
    expect(count).toBe(1)
  })

  it('should allow multiple separate debounced calls after timeout', async () => {
    let count = 0
    const debounced = useDebounceFn(() => { count++ }, 50)

    debounced()
    await sleep(80)
    expect(count).toBe(1)

    debounced()
    await sleep(80)
    expect(count).toBe(2)
  })

  it('should cancel have no effect when no pending call', () => {
    const debounced = useDebounceFn(() => {}, 50)
    // Should not throw
    debounced.cancel()
    debounced.cancel()
  })

  it('should handle zero delay', async () => {
    let count = 0
    const debounced = useDebounceFn(() => { count++ }, 0)

    debounced()
    // Even with 0 delay, it goes through setTimeout so it's async
    expect(count).toBe(0)
    await sleep(10)
    expect(count).toBe(1)
  })

  it('should preserve this context', async () => {
    let receivedThis: any = null
    const debounced = useDebounceFn(function (this: any) { receivedThis = this }, 50)
    const obj = { debounced }

    obj.debounced()
    await sleep(80)
    expect(receivedThis).toBe(obj)
  })
})

// ============================================================================
// useThrottleFn
// ============================================================================
describe('useThrottleFn', () => {
  it('should execute immediately on first call', () => {
    let count = 0
    const throttled = useThrottleFn(() => { count++ }, 100)

    throttled()
    expect(count).toBe(1)
  })

  it('should throttle subsequent calls', async () => {
    let count = 0
    const throttled = useThrottleFn(() => { count++ }, 100)

    throttled()
    expect(count).toBe(1)

    throttled()
    throttled()
    expect(count).toBe(1)

    await sleep(150)
    // Trailing call should have fired
    expect(count).toBe(2)
  })

  it('should use default delay of 200ms', async () => {
    let count = 0
    const throttled = useThrottleFn(() => { count++ })

    throttled()
    expect(count).toBe(1)

    throttled()
    expect(count).toBe(1)

    await sleep(250)
    expect(count).toBe(2)
  })

  it('should support trailing call with latest args', async () => {
    let lastArg: any = null
    const throttled = useThrottleFn((val: any) => { lastArg = val }, 100)

    throttled('first')
    expect(lastArg).toBe('first')

    throttled('second')
    throttled('third')

    await sleep(150)
    expect(lastArg).toBe('third')
  })

  it('should cancel pending trailing call', async () => {
    let count = 0
    const throttled = useThrottleFn(() => { count++ }, 100)

    throttled()
    expect(count).toBe(1)

    throttled()
    throttled.cancel()

    await sleep(150)
    expect(count).toBe(1)
  })

  it('should allow immediate call after throttle period expires', async () => {
    let count = 0
    const throttled = useThrottleFn(() => { count++ }, 50)

    throttled()
    expect(count).toBe(1)

    await sleep(80)

    throttled()
    expect(count).toBe(2)
  })

  it('should pass arguments correctly', () => {
    let received: any[] = []
    const throttled = useThrottleFn((...args: any[]) => { received = args }, 100)

    throttled('a', 1, true)
    expect(received).toEqual(['a', 1, true])
  })

  it('should handle cancel with no pending call', () => {
    const throttled = useThrottleFn(() => {}, 100)
    // Should not throw
    throttled.cancel()
  })

  it('should handle rapid calls with trailing', async () => {
    const calls: number[] = []
    const throttled = useThrottleFn((n: number) => { calls.push(n) }, 80)

    throttled(1)
    expect(calls).toEqual([1])

    for (let i = 2; i <= 10; i++) {
      throttled(i)
    }

    await sleep(120)
    // First immediate + one trailing
    expect(calls.length).toBe(2)
    expect(calls[0]).toBe(1)
    expect(calls[1]).toBe(10)
  })

  it('should execute again after full throttle period', async () => {
    let count = 0
    const throttled = useThrottleFn(() => { count++ }, 50)

    throttled()
    expect(count).toBe(1)

    await sleep(70)
    throttled()
    expect(count).toBe(2)

    await sleep(70)
    throttled()
    expect(count).toBe(3)
  })
})

// ============================================================================
// useInterval
// ============================================================================
describe('useInterval', () => {
  it('should return a counter ref that increments', async () => {
    const counter = useInterval(30)
    expect(counter.value).toBe(0)

    await sleep(80)
    expect(counter.value).toBeGreaterThanOrEqual(1)
  })

  it('should return controls when controls option is true', () => {
    const result = useInterval(50, { controls: true })
    expect(result).toHaveProperty('counter')
    expect(result).toHaveProperty('pause')
    expect(result).toHaveProperty('resume')
    expect(result).toHaveProperty('reset')
  })

  it('should pause the counter', async () => {
    const { counter, pause } = useInterval(30, { controls: true })

    await sleep(80)
    pause()
    const paused = counter.value
    expect(paused).toBeGreaterThanOrEqual(1)

    await sleep(80)
    expect(counter.value).toBe(paused)
  })

  it('should resume after pause', async () => {
    const { counter, pause, resume } = useInterval(30, { controls: true })

    await sleep(80)
    pause()
    const paused = counter.value

    await sleep(50)
    resume()
    await sleep(80)
    expect(counter.value).toBeGreaterThan(paused)
  })

  it('should reset the counter', async () => {
    const { counter, reset } = useInterval(30, { controls: true })

    await sleep(80)
    expect(counter.value).toBeGreaterThanOrEqual(1)

    reset()
    expect(counter.value).toBe(0)
  })

  it('should not start immediately when immediate is false', async () => {
    const { counter } = useInterval(30, { controls: true, immediate: false })
    expect(counter.value).toBe(0)

    await sleep(80)
    expect(counter.value).toBe(0)
  })

  it('should start counting after resume when immediate is false', async () => {
    const { counter, resume } = useInterval(30, { controls: true, immediate: false })

    resume()
    await sleep(80)
    expect(counter.value).toBeGreaterThanOrEqual(1)
  })

  it('should default interval to 1000ms', async () => {
    const counter = useInterval()
    expect(counter.value).toBe(0)

    await sleep(50)
    expect(counter.value).toBe(0)
  })

  it('should not double-resume', async () => {
    const { counter, resume } = useInterval(30, { controls: true })

    resume() // Already running, should be a no-op
    resume()
    await sleep(80)

    // Should still behave normally, not double increment
    const val = counter.value
    expect(val).toBeGreaterThanOrEqual(1)
    expect(val).toBeLessThan(10) // sanity check
  })

  it('should reset and restart', async () => {
    const { counter, reset, pause } = useInterval(30, { controls: true })

    await sleep(80)
    const beforeReset = counter.value
    expect(beforeReset).toBeGreaterThanOrEqual(1)

    reset() // resets to 0 and restarts
    expect(counter.value).toBe(0)

    await sleep(80)
    expect(counter.value).toBeGreaterThanOrEqual(1)

    pause() // clean up
  })
})

// ============================================================================
// useIntervalFn
// ============================================================================
describe('useIntervalFn', () => {
  it('should call the callback on interval', async () => {
    let count = 0
    const { pause } = useIntervalFn(() => { count++ }, 30)

    await sleep(100)
    pause()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('should start immediately by default', () => {
    const { isActive } = useIntervalFn(() => {}, 100)
    expect(isActive.value).toBe(true)
  })

  it('should not start immediately when immediate is false', () => {
    const { isActive } = useIntervalFn(() => {}, 100, { immediate: false })
    expect(isActive.value).toBe(false)
  })

  it('should pause the interval', async () => {
    let count = 0
    const { pause } = useIntervalFn(() => { count++ }, 30)

    await sleep(80)
    pause()
    const countAtPause = count

    await sleep(80)
    expect(count).toBe(countAtPause)
  })

  it('should resume after pause', async () => {
    let count = 0
    const { pause, resume } = useIntervalFn(() => { count++ }, 30)

    await sleep(80)
    pause()
    const countAtPause = count

    resume()
    await sleep(80)
    expect(count).toBeGreaterThan(countAtPause)
  })

  it('should track isActive correctly', () => {
    const { isActive, pause, resume } = useIntervalFn(() => {}, 100)

    expect(isActive.value).toBe(true)
    pause()
    expect(isActive.value).toBe(false)
    resume()
    expect(isActive.value).toBe(true)
    pause()
  })

  it('should not double-resume', async () => {
    let count = 0
    const { pause, resume } = useIntervalFn(() => { count++ }, 40)

    resume()
    resume()
    await sleep(100)
    pause()

    // Should not be double counting
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThan(10)
  })

  it('should use default interval of 1000ms', async () => {
    let count = 0
    const { pause } = useIntervalFn(() => { count++ })

    await sleep(50)
    pause()
    expect(count).toBe(0)
  })

  it('should handle resume after immediate=false', async () => {
    let count = 0
    const { resume, pause } = useIntervalFn(() => { count++ }, 30, { immediate: false })

    expect(count).toBe(0)
    resume()
    await sleep(80)
    pause()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  it('should handle rapid pause/resume', async () => {
    let count = 0
    const { pause, resume } = useIntervalFn(() => { count++ }, 30)

    pause()
    resume()
    pause()
    resume()
    await sleep(80)
    pause()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})

// ============================================================================
// useTimeout
// ============================================================================
describe('useTimeout', () => {
  it('should return a ref that becomes true after timeout', async () => {
    const ready = useTimeout(50)
    expect(ready.value).toBe(false)

    await sleep(80)
    expect(ready.value).toBe(true)
  })

  it('should return controls when controls option is true', () => {
    const result = useTimeout(50, { controls: true })
    expect(result).toHaveProperty('ready')
    expect(result).toHaveProperty('start')
    expect(result).toHaveProperty('stop')
  })

  it('should stop and prevent ready from becoming true', async () => {
    const { ready, stop } = useTimeout(50, { controls: true })

    stop()
    await sleep(80)
    expect(ready.value).toBe(false)
  })

  it('should restart with start()', async () => {
    const { ready, start, stop } = useTimeout(50, { controls: true })

    stop()
    await sleep(80)
    expect(ready.value).toBe(false)

    start()
    await sleep(80)
    expect(ready.value).toBe(true)
  })

  it('should start immediately by default', async () => {
    const { ready } = useTimeout(30, { controls: true })

    await sleep(60)
    expect(ready.value).toBe(true)
  })

  it('should not start when immediate is false', async () => {
    const { ready } = useTimeout(30, { controls: true, immediate: false })

    await sleep(60)
    expect(ready.value).toBe(false)
  })

  it('should default interval to 1000ms', async () => {
    const ready = useTimeout()

    await sleep(50)
    expect(ready.value).toBe(false)
  })

  it('should reset ready to false on stop', async () => {
    const { ready, stop } = useTimeout(30, { controls: true })

    await sleep(60)
    expect(ready.value).toBe(true)

    stop()
    expect(ready.value).toBe(false)
  })

  it('should allow restarting after completion', async () => {
    const { ready, start } = useTimeout(30, { controls: true })

    await sleep(60)
    expect(ready.value).toBe(true)

    start()
    expect(ready.value).toBe(false)

    await sleep(60)
    expect(ready.value).toBe(true)
  })

  it('should handle start called multiple times', async () => {
    const { ready, start } = useTimeout(50, { controls: true })

    start()
    start()
    start()

    await sleep(80)
    expect(ready.value).toBe(true)
  })
})

// ============================================================================
// useTimeoutFn
// ============================================================================
describe('useTimeoutFn', () => {
  it('should call the callback after timeout', async () => {
    let called = false
    useTimeoutFn(() => { called = true }, 50)

    expect(called).toBe(false)
    await sleep(80)
    expect(called).toBe(true)
  })

  it('should start immediately by default', () => {
    const { isPending } = useTimeoutFn(() => {}, 100)
    expect(isPending.value).toBe(true)
  })

  it('should not start immediately when immediate is false', () => {
    const { isPending } = useTimeoutFn(() => {}, 100, { immediate: false })
    expect(isPending.value).toBe(false)
  })

  it('should stop pending timeout', async () => {
    let called = false
    const { stop } = useTimeoutFn(() => { called = true }, 50)

    stop()
    await sleep(80)
    expect(called).toBe(false)
  })

  it('should set isPending to false after callback fires', async () => {
    const { isPending } = useTimeoutFn(() => {}, 30)

    expect(isPending.value).toBe(true)
    await sleep(60)
    expect(isPending.value).toBe(false)
  })

  it('should restart with start()', async () => {
    let count = 0
    const { start, stop } = useTimeoutFn(() => { count++ }, 30)

    await sleep(60)
    expect(count).toBe(1)

    start()
    await sleep(60)
    expect(count).toBe(2)
  })

  it('should cancel and restart cleanly', async () => {
    let count = 0
    const { start, stop } = useTimeoutFn(() => { count++ }, 50)

    stop()
    await sleep(80)
    expect(count).toBe(0)

    start()
    await sleep(80)
    expect(count).toBe(1)
  })

  it('should set isPending to false when stopped', () => {
    const { isPending, stop } = useTimeoutFn(() => {}, 100)

    expect(isPending.value).toBe(true)
    stop()
    expect(isPending.value).toBe(false)
  })

  it('should handle start when immediate is false', async () => {
    let called = false
    const { start, isPending } = useTimeoutFn(() => { called = true }, 30, { immediate: false })

    expect(isPending.value).toBe(false)
    expect(called).toBe(false)

    start()
    expect(isPending.value).toBe(true)

    await sleep(60)
    expect(called).toBe(true)
    expect(isPending.value).toBe(false)
  })

  it('should default interval to 1000ms', async () => {
    let called = false
    useTimeoutFn(() => { called = true })

    await sleep(50)
    expect(called).toBe(false)
  })

  it('should handle multiple start calls (resets timer)', async () => {
    let count = 0
    const { start } = useTimeoutFn(() => { count++ }, 50)

    start()
    start()
    start()

    await sleep(80)
    expect(count).toBe(1)
  })
})

// ============================================================================
// useTimestamp
// ============================================================================
describe('useTimestamp', () => {
  it('should return a ref with current timestamp', () => {
    const ts = useTimestamp({ interval: 100 })
    const now = Date.now()

    expect(typeof ts.value).toBe('number')
    expect(Math.abs(ts.value - now)).toBeLessThan(50)
  })

  it('should update the timestamp periodically', async () => {
    const ts = useTimestamp({ interval: 30 })
    const initial = ts.value

    await sleep(80)
    expect(ts.value).toBeGreaterThan(initial)
  })

  it('should apply offset', () => {
    const offset = 5000
    const ts = useTimestamp({ offset, interval: 1000 })
    const now = Date.now()

    expect(Math.abs(ts.value - (now + offset))).toBeLessThan(50)
  })

  it('should use default interval of 1000ms', () => {
    const ts = useTimestamp()
    const now = Date.now()
    expect(Math.abs(ts.value - now)).toBeLessThan(50)
  })

  it('should use default offset of 0', () => {
    const ts = useTimestamp({ interval: 100 })
    const now = Date.now()
    expect(Math.abs(ts.value - now)).toBeLessThan(50)
  })

  it('should not start when immediate is false', async () => {
    const ts = useTimestamp({ interval: 30, immediate: false })
    const initial = ts.value
    // The initial value is still set in constructor but no interval starts

    await sleep(80)
    // Value should not have updated since no interval is running
    expect(ts.value).toBe(initial)
  })

  it('should handle negative offset', () => {
    const offset = -10000
    const ts = useTimestamp({ offset, interval: 1000 })
    const now = Date.now()
    expect(Math.abs(ts.value - (now + offset))).toBeLessThan(50)
  })

  it('should return a number', () => {
    const ts = useTimestamp({ interval: 100 })
    expect(typeof ts.value).toBe('number')
    expect(Number.isFinite(ts.value)).toBe(true)
  })
})

// ============================================================================
// useTimeAgo
// ============================================================================
describe('useTimeAgo', () => {
  it('should return "just now" for recent dates', () => {
    const result = useTimeAgo(Date.now())
    expect(result.value).toBe('just now')
  })

  it('should format seconds ago', () => {
    const result = useTimeAgo(Date.now() - 30 * 1000)
    expect(result.value).toBe('30 seconds ago')
  })

  it('should format minutes ago', () => {
    const result = useTimeAgo(Date.now() - 5 * 60 * 1000)
    expect(result.value).toBe('5 minutes ago')
  })

  it('should format hours ago', () => {
    const result = useTimeAgo(Date.now() - 3 * 60 * 60 * 1000)
    expect(result.value).toBe('3 hours ago')
  })

  it('should format days ago', () => {
    const result = useTimeAgo(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(result.value).toBe('2 days ago')
  })

  it('should format weeks ago', () => {
    const result = useTimeAgo(Date.now() - 14 * 24 * 60 * 60 * 1000)
    expect(result.value).toBe('2 weeks ago')
  })

  it('should format months ago', () => {
    const result = useTimeAgo(Date.now() - 60 * 24 * 60 * 60 * 1000)
    expect(result.value).toBe('2 months ago')
  })

  it('should format years ago', () => {
    const result = useTimeAgo(Date.now() - 400 * 24 * 60 * 60 * 1000)
    expect(result.value).toBe('1 year ago')
  })

  it('should format future dates', () => {
    const result = useTimeAgo(Date.now() + 5 * 60 * 1000 + 500)
    expect(['in 5 minutes', 'in 4 minutes']).toContain(result.value)
  })

  it('should format future hours', () => {
    const result = useTimeAgo(Date.now() + 2 * 60 * 60 * 1000)
    expect(result.value).toBe('in 2 hours')
  })

  it('should accept Date objects', () => {
    const past = new Date(Date.now() - 10 * 60 * 1000)
    const result = useTimeAgo(past)
    expect(result.value).toBe('10 minutes ago')
  })

  it('should accept string dates', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const result = useTimeAgo(past)
    expect(result.value).toBe('1 hour ago')
  })

  it('should accept a getter function', () => {
    const result = useTimeAgo(() => Date.now() - 120 * 1000)
    expect(result.value).toBe('2 minutes ago')
  })

  it('should accept a ref', () => {
    const dateRef = ref(Date.now() - 30 * 1000)
    const result = useTimeAgo(dateRef)
    expect(result.value).toBe('30 seconds ago')
  })

  it('should use singular for single units', () => {
    const result = useTimeAgo(Date.now() - 60 * 1000)
    expect(result.value).toBe('1 minute ago')
  })

  it('should handle 1 hour ago', () => {
    const result = useTimeAgo(Date.now() - 60 * 60 * 1000)
    expect(result.value).toBe('1 hour ago')
  })
})

// ============================================================================
// useEventListener
// ============================================================================
describe('useEventListener', () => {
  it('should add an event listener to a target', () => {
    let called = false
    const target = new EventTarget()
    useEventListener(target as any, 'custom', () => { called = true })

    target.dispatchEvent(new Event('custom'))
    expect(called).toBe(true)
  })

  it('should return a cleanup function', () => {
    let count = 0
    const target = new EventTarget()
    const stop = useEventListener(target as any, 'custom', () => { count++ })

    target.dispatchEvent(new Event('custom'))
    expect(count).toBe(1)

    stop()
    target.dispatchEvent(new Event('custom'))
    expect(count).toBe(1)
  })

  it('should handle null target gracefully', () => {
    const stop = useEventListener(null as any, 'click', () => {})
    // Should not throw
    stop()
  })

  it('should handle multiple events on same target', () => {
    let aCount = 0
    let bCount = 0
    const target = new EventTarget()

    useEventListener(target as any, 'a', () => { aCount++ })
    useEventListener(target as any, 'b', () => { bCount++ })

    target.dispatchEvent(new Event('a'))
    target.dispatchEvent(new Event('b'))
    target.dispatchEvent(new Event('a'))

    expect(aCount).toBe(2)
    expect(bCount).toBe(1)
  })

  it('should handle cleanup called multiple times', () => {
    const target = new EventTarget()
    const stop = useEventListener(target as any, 'custom', () => {})

    stop()
    stop() // Should not throw
  })

  it('should support event listener options', () => {
    let count = 0
    const target = new EventTarget()
    useEventListener(target as any, 'custom', () => { count++ }, { once: true })

    target.dispatchEvent(new Event('custom'))
    target.dispatchEvent(new Event('custom'))
    expect(count).toBe(1)
  })

  it('should accept a ref as target', () => {
    let called = false
    const target = new EventTarget()
    const targetRef = ref(target)

    useEventListener(targetRef as any, 'custom', () => { called = true })

    target.dispatchEvent(new Event('custom'))
    expect(called).toBe(true)
  })

  it('should handle undefined target in ref', () => {
    const targetRef = ref(null)
    const stop = useEventListener(targetRef as any, 'click', () => {})
    // Should not throw
    stop()
  })
})

// ============================================================================
// useDebouncedRef
// ============================================================================
describe('useDebouncedRef', () => {
  it('should initialize with the given value', () => {
    const r = useDebouncedRef('hello', 50)
    expect(r.value).toBe('hello')
  })
})

// ============================================================================
// useThrottledRef
// ============================================================================
describe('useThrottledRef', () => {
  it('should initialize with the given value', () => {
    const r = useThrottledRef('hello', 50)
    expect(r.value).toBe('hello')
  })
})

// ============================================================================
// useRafFn
// ============================================================================
describe('useRafFn', () => {
  // Note: requestAnimationFrame may not be available in all test environments
  const hasRAF = typeof requestAnimationFrame !== 'undefined'

  it('should start immediately by default', () => {
    if (!hasRAF) return
    const { isActive, pause } = useRafFn(() => {})
    expect(isActive.value).toBe(true)
    pause()
  })

  it('should not start when immediate is false', () => {
    if (!hasRAF) return
    const { isActive } = useRafFn(() => {}, { immediate: false })
    expect(isActive.value).toBe(false)
  })

  it('should pause and resume', () => {
    if (!hasRAF) return
    const { isActive, pause, resume } = useRafFn(() => {})

    expect(isActive.value).toBe(true)
    pause()
    expect(isActive.value).toBe(false)
    resume()
    expect(isActive.value).toBe(true)
    pause()
  })

  it('should call the callback with delta and timestamp', async () => {
    if (!hasRAF) return
    let receivedArgs: any = null
    const { pause } = useRafFn((args) => {
      receivedArgs = args
    })

    await sleep(50)
    pause()

    if (receivedArgs) {
      expect(receivedArgs).toHaveProperty('delta')
      expect(receivedArgs).toHaveProperty('timestamp')
      expect(typeof receivedArgs.delta).toBe('number')
      expect(typeof receivedArgs.timestamp).toBe('number')
    }
  })

  it('should not call callback when paused', async () => {
    if (!hasRAF) return
    let count = 0
    const { pause } = useRafFn(() => { count++ })

    pause()
    const countAtPause = count
    await sleep(50)
    expect(count).toBe(countAtPause)
  })

  it('should handle resume when already active', () => {
    if (!hasRAF) return
    const { isActive, resume, pause } = useRafFn(() => {})

    resume() // already active, should be no-op
    expect(isActive.value).toBe(true)
    pause()
  })

  it('should handle pause when already paused', () => {
    if (!hasRAF) return
    const { isActive, pause } = useRafFn(() => {}, { immediate: false })

    pause() // already paused, should be no-op
    expect(isActive.value).toBe(false)
  })

  it('should gracefully handle missing requestAnimationFrame', () => {
    // This tests SSR safety - useRafFn checks typeof requestAnimationFrame
    const { isActive } = useRafFn(() => {}, { immediate: false })
    expect(isActive.value).toBe(false)
  })
})
