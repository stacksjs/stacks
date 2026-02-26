import { describe, expect, it, mock } from 'bun:test'
import { ref } from '@stacksjs/stx'
import { whenever } from '../src/whenever'
import { watchOnce } from '../src/watchOnce'
import { watchDebounced } from '../src/watchDebounced'
import { watchThrottled } from '../src/watchThrottled'
import { watchPausable, pausableWatch } from '../src/watchPausable'
import { watchIgnorable, ignorableWatch } from '../src/watchIgnorable'
import { watchArray } from '../src/watchArray'
import { watchDeep } from '../src/watchDeep'
import { watchImmediate } from '../src/watchImmediate'
import { watchTriggerable } from '../src/watchTriggerable'
import { watchWithFilter } from '../src/watchWithFilter'

// ============================================================================
// whenever
// ============================================================================

describe('whenever', () => {
  it('should return an unsubscribe function that stops watching', () => {
    const source = ref(false)
    const callback = mock(() => {})

    const stop = whenever(source, callback)
    stop()

    source.value = true
    expect(callback).not.toHaveBeenCalled()
  })
})

// ============================================================================
// watchOnce
// ============================================================================

describe('watchOnce', () => {
  it('should allow manual stop before first trigger', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchOnce(source, callback)
    stop()

    source.value = 1
    expect(callback).not.toHaveBeenCalled()
  })
})

// ============================================================================
// watchDebounced
// ============================================================================

describe('watchDebounced', () => {
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
})

describe('pausableWatch (alias)', () => {
  it('should be the same function as watchPausable', () => {
    expect(pausableWatch).toBe(watchPausable)
  })
})

// ============================================================================
// watchIgnorable / ignorableWatch
// ============================================================================

describe('watchIgnorable', () => {
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
})

describe('ignorableWatch (alias)', () => {
  it('should be the same function as watchIgnorable', () => {
    expect(ignorableWatch).toBe(watchIgnorable)
  })
})

// ============================================================================
// watchArray
// ============================================================================

describe('watchArray', () => {
  it('should return an unsubscribe function', () => {
    const source = ref([1, 2, 3])
    const callback = mock(() => {})

    const stop = watchArray(source, callback)
    stop()

    source.value = [4, 5, 6]
    expect(callback).not.toHaveBeenCalled()
  })
})

// ============================================================================
// watchDeep
// ============================================================================

describe('watchDeep', () => {
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

  it('should return an unsubscribe function', () => {
    const source = ref({ a: 1 })
    const callback = mock(() => {})

    const stop = watchDeep(source, callback)
    stop()

    source.value = { a: 2 }
    expect(callback).not.toHaveBeenCalled()
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
})

// ============================================================================
// watchTriggerable
// ============================================================================

describe('watchTriggerable', () => {
  it('should call callback manually via trigger()', () => {
    const source = ref(42)
    const callback = mock(() => {})

    const { trigger } = watchTriggerable(source, callback)

    trigger()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(42)
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
})

// ============================================================================
// watchWithFilter
// ============================================================================

describe('watchWithFilter', () => {
  it('should return an unsubscribe function', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchWithFilter(source, callback, (invoke) => invoke())

    stop()
    source.value = 1
    expect(callback).not.toHaveBeenCalled()
  })
})
