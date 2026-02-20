import { describe, expect, it, mock } from 'bun:test'
import { ref } from '@stacksjs/stx'
import { whenever } from '../src/whenever'
import { watchOnce } from '../src/watchOnce'
import { watchDebounced } from '../src/watchDebounced'
import { watchThrottled } from '../src/watchThrottled'
import { watchPausable, pausableWatch } from '../src/watchPausable'
import { watchIgnorable, ignorableWatch } from '../src/watchIgnorable'
import { watchArray } from '../src/watchArray'
import { watchAtMost } from '../src/watchAtMost'
import { watchDeep } from '../src/watchDeep'
import { watchImmediate } from '../src/watchImmediate'
import { watchTriggerable } from '../src/watchTriggerable'
import { watchWithFilter } from '../src/watchWithFilter'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ============================================================================
// whenever
// ============================================================================

describe('whenever', () => {
  it('should call callback when value becomes truthy', () => {
    const source = ref(false)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = true
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(true)
  })

  it('should not call callback when value becomes falsy', () => {
    const source = ref(true)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = false
    expect(callback).not.toHaveBeenCalled()
  })

  it('should call callback on each truthy transition', () => {
    const source = ref<boolean | number>(false)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = true
    source.value = false
    source.value = 1

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('should call callback with truthy non-boolean values', () => {
    const source = ref<string | null>(null)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = 'hello'
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('hello')
  })

  it('should not call callback for falsy values like 0, empty string, null, undefined', () => {
    const source = ref<any>('initial')
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = 0
    source.value = ''
    source.value = null
    source.value = undefined

    expect(callback).not.toHaveBeenCalled()
  })

  it('should return an unsubscribe function that stops watching', () => {
    const source = ref(false)
    const callback = mock(() => {})

    const stop = whenever(source, callback)
    stop()

    source.value = true
    expect(callback).not.toHaveBeenCalled()
  })

  it('should handle numeric truthy values', () => {
    const source = ref(0)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = 42
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(42)
  })

  it('should handle repeated truthy values', () => {
    const source = ref<string>('')
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = 'a'
    source.value = 'b'
    source.value = 'c'

    expect(callback).toHaveBeenCalledTimes(3)
  })
})

// ============================================================================
// watchOnce
// ============================================================================

describe('watchOnce', () => {
  it('should call callback on first change only', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should not call callback on subsequent changes', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = 1
    source.value = 2
    source.value = 3

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should allow manual stop before first trigger', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchOnce(source, callback)
    stop()

    source.value = 1
    expect(callback).not.toHaveBeenCalled()
  })

  it('should handle manual stop after first trigger as a no-op', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchOnce(source, callback)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)

    // Calling stop again should be safe
    stop()
    source.value = 2
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should work with string refs', () => {
    const source = ref('hello')
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = 'world'
    expect(callback).toHaveBeenCalledWith('world')

    source.value = 'again'
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should work with object refs', () => {
    const source = ref<{ count: number }>({ count: 0 })
    const callback = mock(() => {})

    watchOnce(source, callback)

    const newObj = { count: 1 }
    source.value = newObj
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(newObj)
  })

  it('should work with boolean refs', () => {
    const source = ref(false)
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = true
    expect(callback).toHaveBeenCalledWith(true)

    source.value = false
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should fire callback even for falsy values (any change triggers it)', () => {
    const source = ref<number | null>(42)
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = 0
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(0)
  })
})

// ============================================================================
// watchDebounced
// ============================================================================

describe('watchDebounced', () => {
  it('should debounce callback invocations', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 50 })

    source.value = 1
    source.value = 2
    source.value = 3

    expect(callback).not.toHaveBeenCalled()

    await sleep(100)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(3)
  })

  it('should use default debounce of 200ms', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback)

    source.value = 1

    await sleep(100)
    expect(callback).not.toHaveBeenCalled()

    await sleep(150)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should reset debounce timer on rapid changes', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 60 })

    source.value = 1
    await sleep(30)

    source.value = 2
    await sleep(30)

    source.value = 3
    await sleep(30)

    // Not yet, timer was reset each time
    expect(callback).not.toHaveBeenCalled()

    await sleep(60)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(3)
  })

  it('should allow separate debounced calls after silence period', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 50 })

    source.value = 1
    await sleep(80)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)

    source.value = 2
    await sleep(80)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(2)
  })

  it('should stop watching and clear timer on stop()', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchDebounced(source, callback, { debounce: 50 })

    source.value = 1
    stop()

    await sleep(100)
    expect(callback).not.toHaveBeenCalled()

    // Changes after stop should also not trigger
    source.value = 2
    await sleep(100)
    expect(callback).not.toHaveBeenCalled()
  })

  it('should handle zero debounce time', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 0 })

    source.value = 1
    await sleep(10)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should work with string values and keep only the latest', async () => {
    const source = ref('')
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 50 })

    source.value = 'h'
    source.value = 'he'
    source.value = 'hel'
    source.value = 'hell'
    source.value = 'hello'

    await sleep(80)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('hello')
  })

  it('should stop cleanly even if no change was made', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchDebounced(source, callback, { debounce: 50 })

    // Stop without any change - should not throw
    stop()
  })
})

// ============================================================================
// watchThrottled
// ============================================================================

describe('watchThrottled', () => {
  it('should call callback immediately on first change', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback, { throttle: 200 })

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should throttle subsequent rapid calls with trailing execution', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback, { throttle: 100 })

    source.value = 1 // immediate
    source.value = 2 // throttled
    source.value = 3 // throttled (overwrites 2)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)

    await sleep(150)

    // trailing call with latest value
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(3)
  })

  it('should use default throttle of 200ms', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback)

    source.value = 1 // immediate
    source.value = 2 // throttled

    expect(callback).toHaveBeenCalledTimes(1)

    await sleep(250)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('should allow new immediate call after throttle window expires', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback, { throttle: 50 })

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)

    await sleep(80)

    source.value = 2
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(2)
  })

  it('should stop watching and clear timer on stop()', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchThrottled(source, callback, { throttle: 100 })

    source.value = 1 // immediate call
    expect(callback).toHaveBeenCalledTimes(1)

    source.value = 2 // would be trailing
    stop()

    await sleep(150)
    // trailing call should be canceled
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should handle single change without trailing call', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback, { throttle: 100 })

    source.value = 1

    await sleep(150)
    // Only one call (the immediate), no trailing needed
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should pass the latest value on trailing call', async () => {
    const source = ref(0)
    const values: number[] = []

    watchThrottled(source, (val) => {
      values.push(val)
    }, { throttle: 100 })

    source.value = 1
    source.value = 2
    source.value = 3
    source.value = 4
    source.value = 5

    await sleep(150)

    expect(values[0]).toBe(1)
    expect(values[1]).toBe(5)
    expect(values.length).toBe(2)
  })

  it('should stop cleanly even when no changes made', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchThrottled(source, callback, { throttle: 100 })
    stop() // should not throw
  })
})

// ============================================================================
// watchPausable / pausableWatch
// ============================================================================

describe('watchPausable', () => {
  it('should call callback when active', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchPausable(source, callback)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1, undefined)
  })

  it('should not call callback when paused', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { pause } = watchPausable(source, callback)

    pause()
    source.value = 1
    expect(callback).not.toHaveBeenCalled()
  })

  it('should resume calling callback after resume()', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { pause, resume } = watchPausable(source, callback)

    pause()
    source.value = 1
    expect(callback).not.toHaveBeenCalled()

    resume()
    source.value = 2
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(2, 1)
  })

  it('should track isActive state correctly', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { isActive, pause, resume } = watchPausable(source, callback)

    expect(isActive.value).toBe(true)

    pause()
    expect(isActive.value).toBe(false)

    resume()
    expect(isActive.value).toBe(true)
  })

  it('should stop watching completely via stop()', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { stop } = watchPausable(source, callback)

    stop()
    source.value = 1
    expect(callback).not.toHaveBeenCalled()
  })

  it('should pass correct old and new values', () => {
    const source = ref(0)
    const calls: Array<[number, number | undefined]> = []

    watchPausable(source, (value, oldValue) => {
      calls.push([value, oldValue])
    })

    source.value = 1
    source.value = 2
    source.value = 3

    expect(calls).toEqual([
      [1, undefined],
      [2, 1],
      [3, 2],
    ])
  })

  it('should track lastValue even when paused', () => {
    const source = ref(0)
    const calls: Array<[number, number | undefined]> = []

    const { pause, resume } = watchPausable(source, (value, oldValue) => {
      calls.push([value, oldValue])
    })

    source.value = 1 // fires (1, undefined)
    pause()
    source.value = 2 // silent but updates lastValue
    resume()
    source.value = 3 // fires (3, 2)

    expect(calls).toEqual([
      [1, undefined],
      [3, 2],
    ])
  })

  it('should handle pause/resume cycles', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { pause, resume } = watchPausable(source, callback)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)

    pause()
    source.value = 2
    source.value = 3
    expect(callback).toHaveBeenCalledTimes(1)

    resume()
    source.value = 4
    expect(callback).toHaveBeenCalledTimes(2)

    pause()
    source.value = 5
    expect(callback).toHaveBeenCalledTimes(2)
  })
})

describe('pausableWatch (alias)', () => {
  it('should be the same function as watchPausable', () => {
    expect(pausableWatch).toBe(watchPausable)
  })

  it('should work identically to watchPausable', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { pause, resume, isActive } = pausableWatch(source, callback)

    expect(isActive.value).toBe(true)
    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)

    pause()
    source.value = 2
    expect(callback).toHaveBeenCalledTimes(1)

    resume()
    source.value = 3
    expect(callback).toHaveBeenCalledTimes(2)
  })
})

// ============================================================================
// watchIgnorable / ignorableWatch
// ============================================================================

describe('watchIgnorable', () => {
  it('should call callback on normal changes', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchIgnorable(source, callback)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1, undefined)
  })

  it('should not call callback during ignoreUpdates', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { ignoreUpdates } = watchIgnorable(source, callback)

    ignoreUpdates(() => {
      source.value = 1
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it('should resume calling callback after ignoreUpdates completes', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { ignoreUpdates } = watchIgnorable(source, callback)

    ignoreUpdates(() => {
      source.value = 1
    })

    expect(callback).not.toHaveBeenCalled()

    // Wait for the microtask that resets isIgnoring
    await Promise.resolve()

    source.value = 2
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(2, 1)
  })

  it('should track isIgnoring state correctly', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { ignoreUpdates, isIgnoring } = watchIgnorable(source, callback)

    expect(isIgnoring.value).toBe(false)

    ignoreUpdates(() => {
      expect(isIgnoring.value).toBe(true)
    })

    // After the microtask, isIgnoring should be false again
    await Promise.resolve()
    expect(isIgnoring.value).toBe(false)
  })

  it('should stop watching completely via stop()', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { stop } = watchIgnorable(source, callback)

    stop()
    source.value = 1
    expect(callback).not.toHaveBeenCalled()
  })

  it('should pass correct old and new values', () => {
    const source = ref(0)
    const calls: Array<[number, number | undefined]> = []

    watchIgnorable(source, (value, oldValue) => {
      calls.push([value, oldValue])
    })

    source.value = 1
    source.value = 2
    source.value = 3

    expect(calls).toEqual([
      [1, undefined],
      [2, 1],
      [3, 2],
    ])
  })

  it('should handle multiple ignoreUpdates calls', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { ignoreUpdates } = watchIgnorable(source, callback)

    ignoreUpdates(() => {
      source.value = 1
    })
    await Promise.resolve()

    ignoreUpdates(() => {
      source.value = 2
    })
    await Promise.resolve()

    expect(callback).not.toHaveBeenCalled()

    source.value = 3
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(3, 2)
  })

  it('should track lastValue even during ignored updates', async () => {
    const source = ref(0)
    const calls: Array<[number, number | undefined]> = []

    const { ignoreUpdates } = watchIgnorable(source, (value, oldValue) => {
      calls.push([value, oldValue])
    })

    source.value = 1 // fires (1, undefined)

    ignoreUpdates(() => {
      source.value = 5 // ignored, but lastValue updated to 5
    })
    await Promise.resolve()

    source.value = 10 // fires (10, 5)

    expect(calls).toEqual([
      [1, undefined],
      [10, 5],
    ])
  })
})

describe('ignorableWatch (alias)', () => {
  it('should be the same function as watchIgnorable', () => {
    expect(ignorableWatch).toBe(watchIgnorable)
  })

  it('should work identically to watchIgnorable', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { ignoreUpdates } = ignorableWatch(source, callback)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)

    ignoreUpdates(() => {
      source.value = 2
    })
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// watchArray
// ============================================================================

describe('watchArray', () => {
  it('should detect added items', () => {
    const source = ref([1, 2, 3])
    const results: { added: number[], removed: number[] }[] = []

    watchArray(source, (_newList, _oldList, added, removed) => {
      results.push({ added, removed })
    })

    source.value = [1, 2, 3, 4]

    expect(results.length).toBe(1)
    expect(results[0].added).toEqual([4])
    expect(results[0].removed).toEqual([])
  })

  it('should detect removed items', () => {
    const source = ref([1, 2, 3])
    const results: { added: number[], removed: number[] }[] = []

    watchArray(source, (_newList, _oldList, added, removed) => {
      results.push({ added, removed })
    })

    source.value = [1, 3]

    expect(results.length).toBe(1)
    expect(results[0].added).toEqual([])
    expect(results[0].removed).toEqual([2])
  })

  it('should detect both added and removed items simultaneously', () => {
    const source = ref([1, 2, 3])
    const results: { added: number[], removed: number[] }[] = []

    watchArray(source, (_newList, _oldList, added, removed) => {
      results.push({ added, removed })
    })

    source.value = [2, 3, 4, 5]

    expect(results.length).toBe(1)
    expect(results[0].added).toEqual([4, 5])
    expect(results[0].removed).toEqual([1])
  })

  it('should provide new and old lists correctly', () => {
    const source = ref<number[]>([1, 2, 3])
    let capturedNew: number[] = []
    let capturedOld: number[] = []

    watchArray(source, (newList, oldList) => {
      capturedNew = newList
      capturedOld = oldList
    })

    source.value = [4, 5, 6]

    expect(capturedNew).toEqual([4, 5, 6])
    expect(capturedOld).toEqual([1, 2, 3])
  })

  it('should handle replacing all items', () => {
    const source = ref(['a', 'b', 'c'])
    const results: { added: string[], removed: string[] }[] = []

    watchArray(source, (_newList, _oldList, added, removed) => {
      results.push({ added, removed })
    })

    source.value = ['x', 'y', 'z']

    expect(results[0].added).toEqual(['x', 'y', 'z'])
    expect(results[0].removed).toEqual(['a', 'b', 'c'])
  })

  it('should handle setting to empty array', () => {
    const source = ref([1, 2, 3])
    const results: { added: number[], removed: number[] }[] = []

    watchArray(source, (_newList, _oldList, added, removed) => {
      results.push({ added, removed })
    })

    source.value = []

    expect(results[0].added).toEqual([])
    expect(results[0].removed).toEqual([1, 2, 3])
  })

  it('should handle starting from empty array', () => {
    const source = ref<number[]>([])
    const results: { added: number[], removed: number[] }[] = []

    watchArray(source, (_newList, _oldList, added, removed) => {
      results.push({ added, removed })
    })

    source.value = [1, 2, 3]

    expect(results[0].added).toEqual([1, 2, 3])
    expect(results[0].removed).toEqual([])
  })

  it('should return an unsubscribe function', () => {
    const source = ref([1, 2, 3])
    const callback = mock(() => {})

    const stop = watchArray(source, callback)
    stop()

    source.value = [4, 5, 6]
    expect(callback).not.toHaveBeenCalled()
  })

  it('should correctly update oldList across multiple changes', () => {
    const source = ref([1, 2])
    const results: { added: number[], removed: number[] }[] = []

    watchArray(source, (_newList, _oldList, added, removed) => {
      results.push({ added, removed })
    })

    source.value = [1, 2, 3] // add 3
    source.value = [1, 3] // remove 2
    source.value = [1, 3, 4] // add 4

    expect(results.length).toBe(3)
    expect(results[0]).toEqual({ added: [3], removed: [] })
    expect(results[1]).toEqual({ added: [], removed: [2] })
    expect(results[2]).toEqual({ added: [4], removed: [] })
  })
})

// ============================================================================
// watchAtMost
// ============================================================================

describe('watchAtMost', () => {
  it('should trigger callback at most the specified count', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchAtMost(source, callback, 3)

    source.value = 1
    source.value = 2
    source.value = 3
    source.value = 4
    source.value = 5

    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('should track remaining count', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { remaining } = watchAtMost(source, callback, 3)

    expect(remaining.value).toBe(3)

    source.value = 1
    expect(remaining.value).toBe(2)

    source.value = 2
    expect(remaining.value).toBe(1)

    source.value = 3
    expect(remaining.value).toBe(0)
  })

  it('should stop after reaching the max count', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { remaining } = watchAtMost(source, callback, 2)

    source.value = 1
    source.value = 2
    source.value = 3

    expect(callback).toHaveBeenCalledTimes(2)
    expect(remaining.value).toBe(0)
  })

  it('should allow manual stop via stop()', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { stop, remaining } = watchAtMost(source, callback, 5)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)

    stop()
    source.value = 2
    expect(callback).toHaveBeenCalledTimes(1)
    expect(remaining.value).toBe(4)
  })

  it('should handle count of 1 (equivalent to watchOnce)', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchAtMost(source, callback, 1)

    source.value = 1
    source.value = 2
    source.value = 3

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should pass the correct value to callback each time', () => {
    const source = ref(0)
    const values: number[] = []

    watchAtMost(source, (val) => {
      values.push(val)
    }, 3)

    source.value = 10
    source.value = 20
    source.value = 30
    source.value = 40

    expect(values).toEqual([10, 20, 30])
  })

  it('should handle count of 0 (never fires)', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { remaining } = watchAtMost(source, callback, 0)

    source.value = 1
    source.value = 2

    expect(callback).not.toHaveBeenCalled()
    expect(remaining.value).toBe(0)
  })

  it('should not decrement remaining below zero', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { remaining } = watchAtMost(source, callback, 2)

    source.value = 1
    source.value = 2
    source.value = 3
    source.value = 4

    expect(remaining.value).toBe(0)
  })
})

// ============================================================================
// watchDeep
// ============================================================================

describe('watchDeep', () => {
  it('should detect changes via deep JSON comparison', () => {
    const source = ref({ a: 1, b: 2 })
    const callback = mock(() => {})

    watchDeep(source, callback)

    source.value = { a: 1, b: 3 }
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should not fire when JSON representation is the same', () => {
    const source = ref({ a: 1, b: 2 })
    const callback = mock(() => {})

    watchDeep(source, callback)

    // Same content, different reference
    source.value = { a: 1, b: 2 }
    expect(callback).not.toHaveBeenCalled()
  })

  it('should call callback immediately when immediate option is true', () => {
    const source = ref({ x: 10 })
    const callback = mock(() => {})

    watchDeep(source, callback, { immediate: true })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith({ x: 10 })
  })

  it('should not call callback immediately when immediate is not set', () => {
    const source = ref({ x: 10 })
    const callback = mock(() => {})

    watchDeep(source, callback)

    expect(callback).not.toHaveBeenCalled()
  })

  it('should detect nested object changes', () => {
    const source = ref({ nested: { value: 1 } })
    const callback = mock(() => {})

    watchDeep(source, callback)

    source.value = { nested: { value: 2 } }
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should detect array changes within objects', () => {
    const source = ref({ items: [1, 2, 3] })
    const callback = mock(() => {})

    watchDeep(source, callback)

    source.value = { items: [1, 2, 3, 4] }
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should return an unsubscribe function', () => {
    const source = ref({ a: 1 })
    const callback = mock(() => {})

    const stop = watchDeep(source, callback)
    stop()

    source.value = { a: 2 }
    expect(callback).not.toHaveBeenCalled()
  })

  it('should handle primitive values', () => {
    const source = ref(42)
    const callback = mock(() => {})

    watchDeep(source, callback)

    source.value = 43
    expect(callback).toHaveBeenCalledTimes(1)

    // Same value should not trigger
    source.value = 43
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// watchImmediate
// ============================================================================

describe('watchImmediate', () => {
  it('should call callback immediately with the current value', () => {
    const source = ref(42)
    const callback = mock(() => {})

    watchImmediate(source, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(42)
  })

  it('should also call callback on subsequent changes', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchImmediate(source, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(0)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(1)

    source.value = 2
    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenCalledWith(2)
  })

  it('should return an unsubscribe function for subsequent changes', () => {
    const source = ref('hello')
    const callback = mock(() => {})

    const stop = watchImmediate(source, callback)

    // Immediate call happened
    expect(callback).toHaveBeenCalledTimes(1)

    stop()

    source.value = 'world'
    // No new call after stop
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should handle null initial values', () => {
    const source = ref<string | null>(null)
    const callback = mock(() => {})

    watchImmediate(source, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(null)
  })

  it('should handle object initial values', () => {
    const initial = { count: 0, name: 'test' }
    const source = ref(initial)
    const callback = mock(() => {})

    watchImmediate(source, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(initial)
  })

  it('should handle array initial values', () => {
    const source = ref([1, 2, 3])
    const callback = mock(() => {})

    watchImmediate(source, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith([1, 2, 3])
  })

  it('should handle boolean initial value of false', () => {
    const source = ref(false)
    const callback = mock(() => {})

    watchImmediate(source, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(false)
  })

  it('should handle multiple rapid changes after immediate', () => {
    const source = ref(0)
    const values: number[] = []

    watchImmediate(source, (val) => {
      values.push(val)
    })

    source.value = 1
    source.value = 2
    source.value = 3

    expect(values).toEqual([0, 1, 2, 3])
  })
})

// ============================================================================
// watchTriggerable
// ============================================================================

describe('watchTriggerable', () => {
  it('should call callback when source changes', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchTriggerable(source, callback)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should call callback manually via trigger()', () => {
    const source = ref(42)
    const callback = mock(() => {})

    const { trigger } = watchTriggerable(source, callback)

    trigger()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(42)
  })

  it('should trigger with the current value at trigger time', () => {
    const source = ref(0)
    const values: number[] = []

    const { trigger } = watchTriggerable(source, (val) => {
      values.push(val)
    })

    trigger()
    source.value = 5
    trigger()

    expect(values).toEqual([0, 5, 5])
  })

  it('should stop watching via stop()', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { stop } = watchTriggerable(source, callback)

    stop()
    source.value = 1
    expect(callback).not.toHaveBeenCalled()
  })

  it('should still allow trigger() after stop()', () => {
    const source = ref(42)
    const callback = mock(() => {})

    const { stop, trigger } = watchTriggerable(source, callback)

    stop()
    source.value = 1
    expect(callback).not.toHaveBeenCalled()

    // trigger is independent of the watch subscription
    trigger()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should handle trigger with no prior source changes', () => {
    const source = ref('initial')
    const callback = mock(() => {})

    const { trigger } = watchTriggerable(source, callback)

    trigger()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('initial')
  })

  it('should handle multiple triggers in sequence', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const { trigger } = watchTriggerable(source, callback)

    trigger()
    trigger()
    trigger()
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('should work with both reactive and manual triggers', () => {
    const source = ref(0)
    const values: number[] = []

    const { trigger } = watchTriggerable(source, (val) => {
      values.push(val)
    })

    source.value = 1    // reactive
    trigger()            // manual (current value is 1)
    source.value = 2    // reactive
    trigger()            // manual (current value is 2)

    expect(values).toEqual([1, 1, 2, 2])
  })
})

// ============================================================================
// watchWithFilter
// ============================================================================

describe('watchWithFilter', () => {
  it('should pass changes through the filter function', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchWithFilter(source, callback, (invoke) => {
      invoke()
    })

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should allow the filter to block invocations', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchWithFilter(source, callback, (_invoke) => {
      // never invoke - blocks all updates
    })

    source.value = 1
    source.value = 2
    expect(callback).not.toHaveBeenCalled()
  })

  it('should support conditional filtering', () => {
    const source = ref(0)
    const callback = mock(() => {})

    // Only invoke when source value is even
    let lastSeenValue = 0
    watchWithFilter(source, callback, (invoke) => {
      if (source.value % 2 === 0) {
        invoke()
      }
    })

    source.value = 1  // odd, blocked
    source.value = 2  // even, allowed
    source.value = 3  // odd, blocked
    source.value = 4  // even, allowed

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(2)
    expect(callback).toHaveBeenCalledWith(4)
  })

  it('should return an unsubscribe function', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchWithFilter(source, callback, (invoke) => invoke())

    stop()
    source.value = 1
    expect(callback).not.toHaveBeenCalled()
  })

  it('should support debounce-like filter', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    let timer: ReturnType<typeof setTimeout> | null = null
    watchWithFilter(source, callback, (invoke) => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(invoke, 50)
    })

    source.value = 1
    source.value = 2
    source.value = 3

    expect(callback).not.toHaveBeenCalled()

    await sleep(80)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(3)
  })

  it('should support throttle-like filter', async () => {
    const source = ref(0)
    const values: number[] = []

    let lastCall = 0
    watchWithFilter(source, (val) => {
      values.push(val)
    }, (invoke) => {
      const now = Date.now()
      if (now - lastCall >= 80) {
        lastCall = now
        invoke()
      }
    })

    source.value = 1  // passes (first call)
    source.value = 2  // blocked (within window)
    source.value = 3  // blocked

    expect(values).toEqual([1])

    await sleep(100)

    source.value = 4  // passes (window expired)
    expect(values).toEqual([1, 4])
  })

  it('should support counting filter (allow every Nth change)', () => {
    const source = ref(0)
    const callback = mock(() => {})

    let count = 0
    watchWithFilter(source, callback, (invoke) => {
      count++
      if (count % 3 === 0) {
        invoke()
      }
    })

    source.value = 1 // count=1, blocked
    source.value = 2 // count=2, blocked
    source.value = 3 // count=3, invoked
    source.value = 4 // count=4, blocked
    source.value = 5 // count=5, blocked
    source.value = 6 // count=6, invoked

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(3)
    expect(callback).toHaveBeenCalledWith(6)
  })

  it('should allow the filter to invoke the callback multiple times', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchWithFilter(source, callback, (invoke) => {
      invoke()
      invoke()
    })

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(2)
  })
})
