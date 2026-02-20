/**
 * Edge case tests for composables that already have basic test coverage.
 * Covers boundary values, error handling, race conditions, and unusual inputs.
 */
import { describe, expect, it, mock } from 'bun:test'
import { ref } from '@stacksjs/stx'

// === STATE COMPOSABLE EDGE CASES ===

describe('useCounter edge cases', () => {
  const { useCounter } = require('../src/useCounter')

  it('should clamp initial value to min/max', () => {
    const { count } = useCounter(100, { min: 0, max: 10 })
    expect(count.value).toBe(10)
  })

  it('should clamp initial value below min', () => {
    const { count } = useCounter(-5, { min: 0, max: 10 })
    expect(count.value).toBe(0)
  })

  it('should handle min === max', () => {
    const { count, inc, dec, set } = useCounter(5, { min: 5, max: 5 })
    expect(count.value).toBe(5)
    inc()
    expect(count.value).toBe(5)
    dec()
    expect(count.value).toBe(5)
    set(100)
    expect(count.value).toBe(5)
  })

  it('should handle negative delta for inc', () => {
    const { count, inc } = useCounter(10)
    inc(-3)
    expect(count.value).toBe(7)
  })

  it('should handle negative delta for dec', () => {
    const { count, dec } = useCounter(10)
    dec(-3)
    expect(count.value).toBe(13)
  })

  it('should handle decimal deltas', () => {
    const { count, inc } = useCounter(0)
    inc(0.1)
    inc(0.2)
    expect(count.value).toBeCloseTo(0.3)
  })

  it('should handle very large numbers', () => {
    const { count, inc } = useCounter(Number.MAX_SAFE_INTEGER - 1)
    inc()
    expect(count.value).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('should get() return same as count.value', () => {
    const { count, get, inc } = useCounter(0)
    expect(get()).toBe(count.value)
    inc(42)
    expect(get()).toBe(count.value)
    expect(get()).toBe(42)
  })

  it('should reset to custom value', () => {
    const { count, inc, reset } = useCounter(0)
    inc(10)
    expect(count.value).toBe(10)
    reset(5)
    expect(count.value).toBe(5)
  })

  it('should reset to initial value by default', () => {
    const { count, inc, reset } = useCounter(7)
    inc(10)
    reset()
    expect(count.value).toBe(7)
  })

  it('should clamp reset value to bounds', () => {
    const { count, reset } = useCounter(5, { min: 0, max: 10 })
    reset(100)
    expect(count.value).toBe(10)
    reset(-5)
    expect(count.value).toBe(0)
  })

  it('should handle NaN delta gracefully', () => {
    const { count, inc } = useCounter(5)
    inc(NaN)
    expect(Number.isNaN(count.value)).toBe(true)
  })

  it('should handle Infinity bounds', () => {
    const { count, inc } = useCounter(0, { min: -Infinity, max: Infinity })
    inc(1e15)
    expect(count.value).toBe(1e15)
  })
})

describe('useCycleList edge cases', () => {
  const { useCycleList } = require('../src/useCycleList')

  it('should throw for empty list', () => {
    expect(() => useCycleList([])).toThrow('useCycleList requires a non-empty list')
  })

  it('should handle single-element list', () => {
    const { state, next, prev, index } = useCycleList(['only'])
    expect(state.value).toBe('only')
    next()
    expect(state.value).toBe('only')
    expect(index.value).toBe(0)
    prev()
    expect(state.value).toBe('only')
    expect(index.value).toBe(0)
  })

  it('should handle negative step in next()', () => {
    const { state, next } = useCycleList(['a', 'b', 'c'])
    next(-1) // should go backward
    expect(state.value).toBe('c')
  })

  it('should handle large step values wrapping', () => {
    const { state, next } = useCycleList(['a', 'b', 'c'])
    next(1000) // 1000 % 3 = 1
    expect(state.value).toBe('b')
  })

  it('should handle negative large step values', () => {
    const { state, prev } = useCycleList(['a', 'b', 'c'])
    prev(1000) // going back 1000 from 0: (0-1000)%3 = -1, normalized to 2
    expect(state.value).toBe('c')
  })

  it('should handle go() with negative index', () => {
    const { state, go } = useCycleList(['a', 'b', 'c'])
    go(-1) // should normalize to 2 (last)
    expect(state.value).toBe('c')
  })

  it('should handle go() with very large index', () => {
    const { state, go } = useCycleList(['a', 'b', 'c'])
    go(100) // 100 % 3 = 1
    expect(state.value).toBe('b')
  })

  it('should handle list with null/undefined values', () => {
    const { state, next } = useCycleList([null, undefined, 'a'])
    expect(state.value).toBe(null)
    next()
    expect(state.value).toBe(undefined)
    next()
    expect(state.value).toBe('a')
  })

  it('should handle initialValue not in list', () => {
    const { index } = useCycleList(['a', 'b', 'c'], { initialValue: 'z' })
    expect(index.value).toBe(0) // defaults to 0 when not found
  })

  it('should handle list with duplicate values', () => {
    const { state, index, next } = useCycleList(['a', 'a', 'b'])
    expect(state.value).toBe('a')
    next()
    expect(index.value).toBe(1)
    expect(state.value).toBe('a') // same value, different index
    next()
    expect(state.value).toBe('b')
  })
})

describe('useStepper edge cases', () => {
  const { useStepper } = require('../src/useStepper')

  it('should handle single-element steps', () => {
    const { isFirst, isLast, current, next, previous } = useStepper(['only'])
    expect(isFirst.value).toBe(true)
    expect(isLast.value).toBe(true)
    expect(current.value).toBe('only')
    next() // should not move
    expect(current.value).toBe('only')
    previous() // should not move
    expect(current.value).toBe('only')
  })

  it('should not navigate past last step', () => {
    const { current, next, index } = useStepper(['a', 'b'])
    next()
    expect(current.value).toBe('b')
    next() // already at end
    expect(current.value).toBe('b')
    expect(index.value).toBe(1)
  })

  it('should not navigate before first step', () => {
    const { current, previous, index } = useStepper(['a', 'b'])
    previous() // already at start
    expect(current.value).toBe('a')
    expect(index.value).toBe(0)
  })

  it('should handle goTo with value not in steps', () => {
    const { current, goTo } = useStepper(['a', 'b', 'c'])
    goTo('z') // not found, should not change
    expect(current.value).toBe('a')
  })

  it('should handle goToIndex with out-of-range values', () => {
    const { current, goToIndex } = useStepper(['a', 'b', 'c'])
    goToIndex(-1) // out of range
    expect(current.value).toBe('a')
    goToIndex(100) // out of range
    expect(current.value).toBe('a')
  })

  it('should handle isBefore/isAfter with non-existent step', () => {
    const { isBefore, isAfter } = useStepper(['a', 'b', 'c'])
    expect(isBefore('z')).toBe(false)
    expect(isAfter('z')).toBe(false)
  })

  it('should handle initialStep not in steps array', () => {
    const { index, current } = useStepper(['a', 'b', 'c'], 'z')
    expect(index.value).toBe(0) // defaults to 0
    expect(current.value).toBe('a')
  })

  it('should handle isCurrent correctly', () => {
    const { isCurrent, next } = useStepper(['a', 'b', 'c'])
    expect(isCurrent('a')).toBe(true)
    expect(isCurrent('b')).toBe(false)
    next()
    expect(isCurrent('a')).toBe(false)
    expect(isCurrent('b')).toBe(true)
  })
})

describe('useCloned edge cases', () => {
  const { useCloned } = require('../src/useCloned')

  it('should deeply clone objects (mutations do not affect source)', () => {
    const source = ref({ nested: { a: 1 } })
    const { cloned } = useCloned(source)
    cloned.value.nested.a = 999
    expect(source.value.nested.a).toBe(1)
  })

  it('should handle null source', () => {
    const source = ref(null)
    const { cloned } = useCloned(source)
    expect(cloned.value).toBeNull()
  })

  it('should handle primitive values', () => {
    const source = ref(42)
    const { cloned } = useCloned(source)
    expect(cloned.value).toBe(42)
  })

  it('should handle arrays', () => {
    const source = ref([1, 2, 3])
    const { cloned } = useCloned(source)
    expect(cloned.value).toEqual([1, 2, 3])
    cloned.value.push(4)
    expect(source.value).toEqual([1, 2, 3])
  })

  it('should use custom clone function', () => {
    const customClone = mock((val: any) => ({ ...val, extra: true }))
    const source = ref({ a: 1 })
    const { cloned } = useCloned(source, { clone: customClone })
    expect(cloned.value).toEqual({ a: 1, extra: true })
    expect(customClone).toHaveBeenCalled()
  })

  it('should sync when source changes', () => {
    const source = ref({ x: 1 })
    const { cloned } = useCloned(source)
    expect(cloned.value).toEqual({ x: 1 })
    source.value = { x: 2 }
    expect(cloned.value).toEqual({ x: 2 })
  })

  it('should manual sync() re-clone from source', () => {
    const source = ref({ x: 1 })
    const { cloned, sync } = useCloned(source)
    // Mutate cloned directly
    cloned.value = { x: 999 } as any
    expect(cloned.value).toEqual({ x: 999 })
    sync()
    expect(cloned.value).toEqual({ x: 1 })
  })

  it('should handle empty object', () => {
    const source = ref({})
    const { cloned } = useCloned(source)
    expect(cloned.value).toEqual({})
  })

  it('should handle string values', () => {
    const source = ref('hello')
    const { cloned } = useCloned(source)
    expect(cloned.value).toBe('hello')
  })
})

describe('useSorted edge cases', () => {
  const { useSorted } = require('../src/useSorted')

  it('should not mutate original array', () => {
    const source = ref([3, 1, 2])
    const sorted = useSorted(source)
    expect(sorted.value).toEqual([1, 2, 3])
    expect(source.value).toEqual([3, 1, 2])
  })

  it('should handle empty array', () => {
    const sorted = useSorted([])
    expect(sorted.value).toEqual([])
  })

  it('should handle single element', () => {
    const sorted = useSorted([42])
    expect(sorted.value).toEqual([42])
  })

  it('should handle already sorted array', () => {
    const sorted = useSorted([1, 2, 3, 4, 5])
    expect(sorted.value).toEqual([1, 2, 3, 4, 5])
  })

  it('should handle reverse-sorted array', () => {
    const sorted = useSorted([5, 4, 3, 2, 1])
    expect(sorted.value).toEqual([1, 2, 3, 4, 5])
  })

  it('should handle string arrays with default sort', () => {
    const sorted = useSorted(['banana', 'apple', 'cherry'])
    expect(sorted.value).toEqual(['apple', 'banana', 'cherry'])
  })

  it('should use custom comparator', () => {
    const sorted = useSorted([3, 1, 2], (a: number, b: number) => b - a) // descending
    expect(sorted.value).toEqual([3, 2, 1])
  })

  it('should handle arrays with duplicate values', () => {
    const sorted = useSorted([3, 1, 2, 1, 3])
    expect(sorted.value).toEqual([1, 1, 2, 3, 3])
  })

  it('should handle numeric strings (default sort is lexicographic)', () => {
    const sorted = useSorted(['10', '9', '100', '2'])
    expect(sorted.value).toEqual(['10', '100', '2', '9'])
  })

  it('should react to ref changes', () => {
    const source = ref([3, 1, 2])
    const sorted = useSorted(source)
    expect(sorted.value).toEqual([1, 2, 3])
    source.value = [5, 4]
    expect(sorted.value).toEqual([4, 5])
  })

  it('should handle raw array (non-ref)', () => {
    const sorted = useSorted([3, 1, 2])
    expect(sorted.value).toEqual([1, 2, 3])
  })
})

describe('useAsyncState edge cases', () => {
  const { useAsyncState } = require('../src/useAsyncState')

  it('should handle immediate: false (no auto-execute)', async () => {
    let called = false
    const { state, isLoading, isReady } = useAsyncState(async () => {
      called = true
      return 42
    }, 0, { immediate: false })
    await new Promise(r => setTimeout(r, 50))
    expect(called).toBe(false)
    expect(state.value).toBe(0)
    expect(isLoading.value).toBe(false)
    expect(isReady.value).toBe(false)
  })

  it('should handle rejected promise', async () => {
    const { error, isLoading, execute } = useAsyncState(
      async () => { throw new Error('boom') },
      null,
      { immediate: false },
    )
    await execute()
    expect(error.value).toBeInstanceOf(Error)
    expect((error.value as Error).message).toBe('boom')
    expect(isLoading.value).toBe(false)
  })

  it('should call onError callback', async () => {
    const onError = mock(() => {})
    const { execute } = useAsyncState(
      async () => { throw new Error('test') },
      null,
      { immediate: false, onError },
    )
    await execute()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('should reset state on execute when resetOnExecute is true', async () => {
    let counter = 0
    const { state, execute } = useAsyncState(
      async () => ++counter,
      0,
      { immediate: false, resetOnExecute: true },
    )
    await execute()
    expect(state.value).toBe(1)
    await execute()
    expect(state.value).toBe(2)
  })

  it('should not reset state on execute when resetOnExecute is false', async () => {
    let counter = 0
    const { state, execute } = useAsyncState(
      async () => ++counter,
      0,
      { immediate: false, resetOnExecute: false },
    )
    await execute()
    expect(state.value).toBe(1)
    // State should still be 1 just before the async completes
  })

  it('should handle execute with custom delay', async () => {
    const start = Date.now()
    const { execute } = useAsyncState(
      async () => 'done',
      null,
      { immediate: false },
    )
    await execute(50)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(40) // allow some timing slack
  })

  it('should clear error on successful re-execute', async () => {
    let shouldFail = true
    const { error, execute } = useAsyncState(
      async () => {
        if (shouldFail) throw new Error('fail')
        return 'ok'
      },
      null,
      { immediate: false },
    )
    await execute()
    expect(error.value).toBeInstanceOf(Error)
    shouldFail = false
    await execute()
    expect(error.value).toBeUndefined()
  })

  it('should accept a raw Promise (not just function)', async () => {
    const { state } = useAsyncState(Promise.resolve(42), 0)
    await new Promise(r => setTimeout(r, 50))
    expect(state.value).toBe(42)
  })
})

describe('useAsyncQueue edge cases', () => {
  const { useAsyncQueue } = require('../src/useAsyncQueue')

  it('should handle empty task array', async () => {
    const { isFinished, result } = useAsyncQueue([])
    await new Promise(r => setTimeout(r, 50))
    expect(isFinished.value).toBe(true)
    expect(result.value).toEqual([])
  })

  it('should handle task that returns undefined', async () => {
    const { result, isFinished } = useAsyncQueue([
      async () => undefined,
    ])
    await new Promise(r => setTimeout(r, 50))
    expect(isFinished.value).toBe(true)
    expect(result.value[0].state).toBe('fulfilled')
    expect(result.value[0].data).toBeUndefined()
  })

  it('should handle task that rejects', async () => {
    const { result, isFinished } = useAsyncQueue([
      async () => { throw new Error('task failed') },
    ])
    await new Promise(r => setTimeout(r, 50))
    expect(isFinished.value).toBe(true)
    expect(result.value[0].state).toBe('rejected')
  })

  it('should continue executing tasks after a failure', async () => {
    const { result, isFinished } = useAsyncQueue([
      async () => { throw new Error('fail') },
      async () => 'success',
    ])
    await new Promise(r => setTimeout(r, 50))
    expect(isFinished.value).toBe(true)
    expect(result.value[0].state).toBe('rejected')
    expect(result.value[1].state).toBe('fulfilled')
    expect(result.value[1].data).toBe('success')
  })

  it('should run tasks sequentially', async () => {
    const order: number[] = []
    const { isFinished } = useAsyncQueue([
      async () => { order.push(1); return 1 },
      async () => { order.push(2); return 2 },
      async () => { order.push(3); return 3 },
    ])
    await new Promise(r => setTimeout(r, 50))
    expect(isFinished.value).toBe(true)
    expect(order).toEqual([1, 2, 3])
  })

  it('should set activeIndex to tasks.length when complete', async () => {
    const tasks = [async () => 1, async () => 2]
    const { activeIndex, isFinished } = useAsyncQueue(tasks)
    await new Promise(r => setTimeout(r, 50))
    expect(isFinished.value).toBe(true)
    expect(activeIndex.value).toBe(2)
  })
})

// === MANUAL REF HISTORY EDGE CASES ===

describe('useManualRefHistory edge cases', () => {
  const { useManualRefHistory } = require('../src/useManualRefHistory')

  it('should start with canUndo false and canRedo false', () => {
    const source = ref(0)
    const { canUndo, canRedo } = useManualRefHistory(source)
    expect(canUndo.value).toBe(false)
    expect(canRedo.value).toBe(false)
  })

  it('should not undo past initial state', () => {
    const source = ref('init')
    const { undo, canUndo } = useManualRefHistory(source)
    undo() // should do nothing
    expect(source.value).toBe('init')
    expect(canUndo.value).toBe(false)
  })

  it('should not redo when nothing to redo', () => {
    const source = ref('init')
    const { redo, canRedo } = useManualRefHistory(source)
    redo() // should do nothing
    expect(source.value).toBe('init')
    expect(canRedo.value).toBe(false)
  })

  it('should enforce capacity limit', () => {
    const source = ref(0)
    const { commit, history } = useManualRefHistory(source, { capacity: 3 })
    // initial entry + 4 commits = 5, should trim to 3
    source.value = 1; commit()
    source.value = 2; commit()
    source.value = 3; commit()
    source.value = 4; commit()
    expect(history.value.length).toBeLessThanOrEqual(3)
  })

  it('should clear redo stack on new commit', () => {
    const source = ref(0)
    const { commit, undo, redo, canRedo } = useManualRefHistory(source)
    source.value = 1; commit()
    source.value = 2; commit()
    undo()
    expect(canRedo.value).toBe(true)
    source.value = 3; commit() // new commit should clear redo
    expect(canRedo.value).toBe(false)
  })

  it('should undo then redo correctly', () => {
    const source = ref(0)
    const { commit, undo, redo } = useManualRefHistory(source)
    source.value = 1; commit()
    source.value = 2; commit()
    undo()
    expect(source.value).toBe(1)
    redo()
    expect(source.value).toBe(2)
  })

  it('should handle multiple undo/redo cycles', () => {
    const source = ref('a')
    const { commit, undo, redo } = useManualRefHistory(source)
    source.value = 'b'; commit()
    source.value = 'c'; commit()

    undo() // c -> b
    expect(source.value).toBe('b')
    undo() // b -> a
    expect(source.value).toBe('a')
    redo() // a -> b
    expect(source.value).toBe('b')
    redo() // b -> c
    expect(source.value).toBe('c')
  })

  it('should clear history', () => {
    const source = ref(0)
    const { commit, clear, history, canUndo } = useManualRefHistory(source)
    source.value = 1; commit()
    source.value = 2; commit()
    clear()
    expect(history.value.length).toBe(1)
    expect(canUndo.value).toBe(false)
  })

  it('should track last entry', () => {
    const source = ref(0)
    const { commit, last } = useManualRefHistory(source)
    expect(last.value.snapshot).toBe(0)
    source.value = 42; commit()
    expect(last.value.snapshot).toBe(42)
  })

  it('should clone values when clone option is true', () => {
    const source = ref({ a: 1 })
    const { commit, history } = useManualRefHistory(source, { clone: true })
    source.value = { a: 2 }; commit()
    // Mutating source should not affect history
    source.value.a = 999
    expect(history.value[1].snapshot.a).toBe(2)
  })
})

// === REF HISTORY EDGE CASES ===

describe('useRefHistory edge cases', () => {
  const { useRefHistory } = require('../src/useRefHistory')

  it('should auto-commit on source change', () => {
    const source = ref(0)
    const { history } = useRefHistory(source)
    expect(history.value.length).toBe(1) // initial
    source.value = 1
    expect(history.value.length).toBe(2)
    source.value = 2
    expect(history.value.length).toBe(3)
  })

  it('should not create extra commits during undo/redo', () => {
    const source = ref(0)
    const { undo, history } = useRefHistory(source)
    source.value = 1
    source.value = 2
    expect(history.value.length).toBe(3)
    undo()
    // undo should restore source to 1 but NOT trigger an auto-commit
    expect(source.value).toBe(1)
    expect(history.value.length).toBe(2)
  })

  it('should enforce capacity', () => {
    const source = ref(0)
    const { history } = useRefHistory(source, { capacity: 3 })
    source.value = 1
    source.value = 2
    source.value = 3
    source.value = 4
    expect(history.value.length).toBeLessThanOrEqual(3)
  })

  it('should handle rapid changes', () => {
    const source = ref(0)
    const { history } = useRefHistory(source)
    for (let i = 1; i <= 20; i++) {
      source.value = i
    }
    expect(history.value.length).toBe(21) // initial + 20 changes
    expect(source.value).toBe(20)
  })
})

// === TIMING COMPOSABLE EDGE CASES ===

describe('useInterval edge cases', () => {
  const { useInterval } = require('../src/useInterval')

  it('should return controls when controls: true', () => {
    const result = useInterval(100, { controls: true })
    expect(result.counter).toBeDefined()
    expect(result.pause).toBeDefined()
    expect(result.resume).toBeDefined()
    expect(result.reset).toBeDefined()
    result.pause() // cleanup
  })

  it('should return just a ref when controls: false', () => {
    const result = useInterval(100000) // long interval so it doesn't tick
    expect(result.value).toBe(0)
  })

  it('should not start when immediate: false', async () => {
    const { counter, resume, pause } = useInterval(10, { controls: true, immediate: false })
    expect(counter.value).toBe(0)
    await new Promise(r => setTimeout(r, 50))
    expect(counter.value).toBe(0)
    resume()
    await new Promise(r => setTimeout(r, 50))
    expect(counter.value).toBeGreaterThan(0)
    pause() // cleanup
  })

  it('should reset counter and restart', async () => {
    const { counter, pause, reset } = useInterval(10, { controls: true })
    await new Promise(r => setTimeout(r, 80))
    expect(counter.value).toBeGreaterThan(0)
    reset()
    expect(counter.value).toBe(0)
    await new Promise(r => setTimeout(r, 80))
    expect(counter.value).toBeGreaterThan(0)
    pause() // cleanup
  })

  it('should pause and resume correctly', async () => {
    const { counter, pause, resume } = useInterval(10, { controls: true })
    await new Promise(r => setTimeout(r, 60))
    pause()
    const pausedVal = counter.value
    await new Promise(r => setTimeout(r, 50))
    expect(counter.value).toBe(pausedVal) // should not have changed
    resume()
    await new Promise(r => setTimeout(r, 60))
    expect(counter.value).toBeGreaterThan(pausedVal)
    pause() // cleanup
  })

  it('should not double-resume', async () => {
    const { counter, pause, resume } = useInterval(10, { controls: true })
    resume() // already running, should be no-op
    resume() // still no-op
    await new Promise(r => setTimeout(r, 60))
    // If double-resume started two intervals, counter would increment twice as fast
    // With 10ms interval and 60ms wait, single interval should give ~6 ticks
    expect(counter.value).toBeLessThan(15)
    pause() // cleanup
  })
})

describe('useTimeAgo edge cases', () => {
  const { useTimeAgo } = require('../src/useTimeAgo')

  it('should return "just now" for very recent dates', () => {
    const result = useTimeAgo(new Date())
    expect(result.value).toBe('just now')
  })

  it('should handle past dates in seconds', () => {
    const tenSecondsAgo = Date.now() - 10000
    const result = useTimeAgo(tenSecondsAgo)
    expect(result.value).toMatch(/\d+ seconds? ago/)
  })

  it('should handle past dates in minutes', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const result = useTimeAgo(fiveMinutesAgo)
    expect(result.value).toMatch(/\d+ minutes? ago/)
  })

  it('should handle past dates in hours', () => {
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000
    const result = useTimeAgo(threeHoursAgo)
    expect(result.value).toMatch(/\d+ hours? ago/)
  })

  it('should handle past dates in days', () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000
    const result = useTimeAgo(twoDaysAgo)
    expect(result.value).toMatch(/\d+ days? ago/)
  })

  it('should handle past dates in weeks', () => {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
    const result = useTimeAgo(twoWeeksAgo)
    expect(result.value).toMatch(/\d+ weeks? ago/)
  })

  it('should handle past dates in months', () => {
    const twoMonthsAgo = Date.now() - 60 * 24 * 60 * 60 * 1000
    const result = useTimeAgo(twoMonthsAgo)
    expect(result.value).toMatch(/\d+ months? ago/)
  })

  it('should handle past dates in years', () => {
    const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000
    const result = useTimeAgo(twoYearsAgo)
    expect(result.value).toMatch(/\d+ years? ago/)
  })

  it('should handle future dates', () => {
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000
    const result = useTimeAgo(fiveMinutesFromNow)
    expect(result.value).toMatch(/^in \d+ minutes?$/)
  })

  it('should handle future dates in hours', () => {
    const threeHoursFromNow = Date.now() + 3 * 60 * 60 * 1000
    const result = useTimeAgo(threeHoursFromNow)
    expect(result.value).toMatch(/^in \d+ hours?$/)
  })

  it('should handle Date object input', () => {
    const date = new Date(Date.now() - 60000)
    const result = useTimeAgo(date)
    expect(result.value).toMatch(/minute/)
  })

  it('should handle string date input', () => {
    const date = new Date(Date.now() - 120000).toISOString()
    const result = useTimeAgo(date)
    expect(result.value).toMatch(/minutes? ago/)
  })

  it('should handle numeric timestamp input', () => {
    const timestamp = Date.now() - 3600000
    const result = useTimeAgo(timestamp)
    expect(result.value).toMatch(/hour/)
  })

  it('should handle singular units (1 second, 1 minute, etc.)', () => {
    const oneMinuteAgo = Date.now() - 61000
    const result = useTimeAgo(oneMinuteAgo)
    expect(result.value).toBe('1 minute ago')
  })

  it('should use "just now" for exactly now', () => {
    const result = useTimeAgo(Date.now())
    expect(result.value).toBe('just now')
  })
})

// === SHARED UTILITIES EDGE CASES ===

describe('_shared utilities edge cases', () => {
  const { unref, toValue, isRef } = require('../src/_shared')

  it('unref should return raw value for non-ref', () => {
    expect(unref(42)).toBe(42)
    expect(unref('hello')).toBe('hello')
    expect(unref(null)).toBeNull()
    expect(unref(undefined)).toBeUndefined()
  })

  it('unref should unwrap ref', () => {
    const r = ref(42)
    expect(unref(r)).toBe(42)
  })

  it('toValue should call getter function', () => {
    expect(toValue(() => 42)).toBe(42)
  })

  it('toValue should unwrap ref', () => {
    const r = ref('test')
    expect(toValue(r)).toBe('test')
  })

  it('toValue should return raw value', () => {
    expect(toValue(42)).toBe(42)
  })

  it('isRef should detect ref', () => {
    expect(isRef(ref(0))).toBe(true)
  })

  it('isRef should reject non-ref objects', () => {
    expect(isRef(42)).toBe(false)
    expect(isRef('hello')).toBe(false)
    expect(isRef(null)).toBe(false)
    expect(isRef(undefined)).toBe(false)
    expect(isRef({ value: 1 })).toBe(false) // has value but no subscribe
  })

  it('isRef should reject objects with only value property', () => {
    expect(isRef({ value: 1, other: 2 })).toBe(false)
  })
})
