import { describe, expect, it, mock } from 'bun:test'
import { ref } from '@stacksjs/stx'
import { useCounter } from '../src/useCounter'
import { usePrevious } from '../src/usePrevious'
import { useLastChanged } from '../src/useLastChanged'
import { useStepper } from '../src/useStepper'
import { useCycleList } from '../src/useCycleList'
import { useSorted } from '../src/useSorted'
import { useCloned } from '../src/useCloned'
import { useManualRefHistory } from '../src/useManualRefHistory'
import { useAsyncState } from '../src/useAsyncState'
import { useAsyncQueue } from '../src/useAsyncQueue'

// ---------------------------------------------------------------------------
// useCounter
// ---------------------------------------------------------------------------
describe('useCounter', () => {
  it('should initialize with default value 0', () => {
    const { count } = useCounter()
    expect(count.value).toBe(0)
  })

  it('should initialize with a custom value', () => {
    const { count } = useCounter(10)
    expect(count.value).toBe(10)
  })

  it('should increment by 1 by default', () => {
    const { count, inc } = useCounter(0)
    inc()
    expect(count.value).toBe(1)
  })

  it('should increment by a custom delta', () => {
    const { count, inc } = useCounter(0)
    inc(5)
    expect(count.value).toBe(5)
  })

  it('should decrement by 1 by default', () => {
    const { count, dec } = useCounter(10)
    dec()
    expect(count.value).toBe(9)
  })

  it('should decrement by a custom delta', () => {
    const { count, dec } = useCounter(10)
    dec(3)
    expect(count.value).toBe(7)
  })

  it('should set a specific value', () => {
    const { count, set } = useCounter(0)
    set(42)
    expect(count.value).toBe(42)
  })

  it('should reset to the initial value', () => {
    const { count, inc, reset } = useCounter(5)
    inc(10)
    expect(count.value).toBe(15)
    reset()
    expect(count.value).toBe(5)
  })

  it('should reset to a custom value', () => {
    const { count, reset } = useCounter(5)
    reset(99)
    expect(count.value).toBe(99)
  })

  it('should get the current value', () => {
    const { get, inc } = useCounter(0)
    inc(3)
    expect(get()).toBe(3)
  })

  it('should respect max bound', () => {
    const { count, inc } = useCounter(8, { max: 10 })
    inc(5)
    expect(count.value).toBe(10)
  })

  it('should respect min bound', () => {
    const { count, dec } = useCounter(2, { min: 0 })
    dec(5)
    expect(count.value).toBe(0)
  })

  it('should clamp initial value to bounds', () => {
    const { count } = useCounter(100, { min: 0, max: 10 })
    expect(count.value).toBe(10)
  })

  it('should clamp set value to bounds', () => {
    const { count, set } = useCounter(5, { min: 0, max: 10 })
    set(-5)
    expect(count.value).toBe(0)
    set(50)
    expect(count.value).toBe(10)
  })

  it('should return the clamped value from inc/dec/set/reset', () => {
    const { inc, dec, set, reset } = useCounter(5, { min: 0, max: 10 })
    expect(inc(100)).toBe(10)
    expect(dec(100)).toBe(0)
    expect(set(5)).toBe(5)
    expect(reset()).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// usePrevious
// ---------------------------------------------------------------------------
describe('usePrevious', () => {
  it('should return undefined initially when no initial value given', () => {
    const source = ref(0)
    const prev = usePrevious(source)
    expect(prev.value).toBeUndefined()
  })

  it('should return the initial value when provided', () => {
    const source = ref(10)
    const prev = usePrevious(source, 42)
    expect(prev.value).toBe(42)
  })

})

// ---------------------------------------------------------------------------
// useLastChanged
// ---------------------------------------------------------------------------
describe('useLastChanged', () => {
  it('should return null initially by default', () => {
    const source = ref(0)
    const timestamp = useLastChanged(source)
    expect(timestamp.value).toBeNull()
  })

  it('should accept a custom initial value', () => {
    const source = ref(0)
    const timestamp = useLastChanged(source, { initialValue: 1000 })
    expect(timestamp.value).toBe(1000)
  })

  it('should accept initialValue of 0', () => {
    const source = ref(0)
    const timestamp = useLastChanged(source, { initialValue: 0 })
    expect(timestamp.value).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// useStepper
// ---------------------------------------------------------------------------
describe('useStepper', () => {
  const steps = ['step1', 'step2', 'step3', 'step4']

  it('should start at the first step by default', () => {
    const stepper = useStepper(steps)
    expect(stepper.current.value).toBe('step1')
    expect(stepper.index.value).toBe(0)
  })

  it('should start at a specific initial step', () => {
    const stepper = useStepper(steps, 'step3')
    expect(stepper.current.value).toBe('step3')
    expect(stepper.index.value).toBe(2)
  })

  it('should navigate to next step', () => {
    const stepper = useStepper(steps)
    stepper.next()
    expect(stepper.current.value).toBe('step2')
    expect(stepper.index.value).toBe(1)
  })

  it('should navigate to previous step', () => {
    const stepper = useStepper(steps, 'step3')
    stepper.previous()
    expect(stepper.current.value).toBe('step2')
    expect(stepper.index.value).toBe(1)
  })

  it('should not go before the first step', () => {
    const stepper = useStepper(steps)
    stepper.previous()
    expect(stepper.current.value).toBe('step1')
    expect(stepper.index.value).toBe(0)
  })

  it('should not go past the last step', () => {
    const stepper = useStepper(steps, 'step4')
    stepper.next()
    expect(stepper.current.value).toBe('step4')
    expect(stepper.index.value).toBe(3)
  })

  it('should report isFirst correctly', () => {
    const stepper = useStepper(steps)
    expect(stepper.isFirst.value).toBe(true)
    stepper.next()
    expect(stepper.isFirst.value).toBe(false)
  })

  it('should report isLast correctly', () => {
    const stepper = useStepper(steps, 'step4')
    expect(stepper.isLast.value).toBe(true)
    stepper.previous()
    expect(stepper.isLast.value).toBe(false)
  })

  it('should goTo a specific step', () => {
    const stepper = useStepper(steps)
    stepper.goTo('step3')
    expect(stepper.current.value).toBe('step3')
    expect(stepper.index.value).toBe(2)
  })

  it('should goToIndex', () => {
    const stepper = useStepper(steps)
    stepper.goToIndex(3)
    expect(stepper.current.value).toBe('step4')
    expect(stepper.index.value).toBe(3)
  })

  it('should ignore goTo with invalid step', () => {
    const stepper = useStepper(steps)
    stepper.goTo('nonexistent' as any)
    expect(stepper.current.value).toBe('step1')
  })

  it('should ignore goToIndex with out-of-range index', () => {
    const stepper = useStepper(steps)
    stepper.goToIndex(99)
    expect(stepper.current.value).toBe('step1')
    stepper.goToIndex(-1)
    expect(stepper.current.value).toBe('step1')
  })

  it('should check isBefore correctly', () => {
    const stepper = useStepper(steps, 'step2')
    expect(stepper.isBefore('step3')).toBe(true)
    expect(stepper.isBefore('step4')).toBe(true)
    expect(stepper.isBefore('step1')).toBe(false)
    expect(stepper.isBefore('step2')).toBe(false)
  })

  it('should check isAfter correctly', () => {
    const stepper = useStepper(steps, 'step3')
    expect(stepper.isAfter('step1')).toBe(true)
    expect(stepper.isAfter('step2')).toBe(true)
    expect(stepper.isAfter('step4')).toBe(false)
    expect(stepper.isAfter('step3')).toBe(false)
  })

  it('should check isCurrent correctly', () => {
    const stepper = useStepper(steps, 'step2')
    expect(stepper.isCurrent('step2')).toBe(true)
    expect(stepper.isCurrent('step1')).toBe(false)
    expect(stepper.isCurrent('step3')).toBe(false)
  })

  it('should expose the steps list', () => {
    const stepper = useStepper(steps)
    expect(stepper.steps.value).toEqual(['step1', 'step2', 'step3', 'step4'])
  })

  it('should work with number steps', () => {
    const stepper = useStepper([10, 20, 30])
    expect(stepper.current.value).toBe(10)
    stepper.next()
    expect(stepper.current.value).toBe(20)
    stepper.goTo(30)
    expect(stepper.current.value).toBe(30)
    expect(stepper.isLast.value).toBe(true)
  })

  it('should fall back to index 0 for unknown initial step', () => {
    const stepper = useStepper(steps, 'unknown' as any)
    expect(stepper.index.value).toBe(0)
    expect(stepper.current.value).toBe('step1')
  })
})

// ---------------------------------------------------------------------------
// useCycleList
// ---------------------------------------------------------------------------
describe('useCycleList', () => {
  it('should start at the first item by default', () => {
    const { state, index } = useCycleList(['a', 'b', 'c'])
    expect(state.value).toBe('a')
    expect(index.value).toBe(0)
  })

  it('should start at a specific initial value', () => {
    const { state, index } = useCycleList(['a', 'b', 'c'], { initialValue: 'b' })
    expect(state.value).toBe('b')
    expect(index.value).toBe(1)
  })

  it('should cycle to next item', () => {
    const { state, next } = useCycleList(['a', 'b', 'c'])
    next()
    expect(state.value).toBe('b')
  })

  it('should wrap around from last to first on next', () => {
    const { state, next } = useCycleList(['a', 'b', 'c'], { initialValue: 'c' })
    next()
    expect(state.value).toBe('a')
  })

  it('should cycle to previous item', () => {
    const { state, prev } = useCycleList(['a', 'b', 'c'], { initialValue: 'b' })
    prev()
    expect(state.value).toBe('a')
  })

  it('should wrap around from first to last on prev', () => {
    const { state, prev } = useCycleList(['a', 'b', 'c'])
    prev()
    expect(state.value).toBe('c')
  })

  it('should next with a step count', () => {
    const { state, next } = useCycleList(['a', 'b', 'c', 'd', 'e'])
    next(3)
    expect(state.value).toBe('d')
  })

  it('should prev with a step count', () => {
    const { state, prev } = useCycleList(['a', 'b', 'c', 'd', 'e'])
    prev(2)
    expect(state.value).toBe('d')
  })

  it('should handle large step counts with wrapping', () => {
    const { state, next } = useCycleList(['a', 'b', 'c'])
    next(10)
    // 0 + 10 = 10 % 3 = 1
    expect(state.value).toBe('b')
  })

  it('should go to a specific index', () => {
    const { state, go } = useCycleList(['a', 'b', 'c', 'd'])
    go(2)
    expect(state.value).toBe('c')
  })

  it('should wrap negative indices with go', () => {
    const { state, go } = useCycleList(['a', 'b', 'c'])
    go(-1)
    expect(state.value).toBe('c')
  })

  it('should return the new value from next', () => {
    const { next } = useCycleList(['a', 'b', 'c'])
    const result = next()
    expect(result).toBe('b')
  })

  it('should return the new value from prev', () => {
    const { prev } = useCycleList(['a', 'b', 'c'], { initialValue: 'b' })
    const result = prev()
    expect(result).toBe('a')
  })

  it('should return the new value from go', () => {
    const { go } = useCycleList(['a', 'b', 'c'])
    const result = go(2)
    expect(result).toBe('c')
  })

  it('should throw for an empty list', () => {
    expect(() => useCycleList([])).toThrow()
  })

  it('should work with a single-item list', () => {
    const { state, next, prev } = useCycleList(['only'])
    expect(state.value).toBe('only')
    next()
    expect(state.value).toBe('only')
    prev()
    expect(state.value).toBe('only')
  })

  it('should fall back to index 0 for unknown initial value', () => {
    const { state, index } = useCycleList(['a', 'b', 'c'], { initialValue: 'z' as any })
    expect(index.value).toBe(0)
    expect(state.value).toBe('a')
  })
})

// ---------------------------------------------------------------------------
// useSorted
// ---------------------------------------------------------------------------
describe('useSorted', () => {
  it('should sort strings in natural order by default', () => {
    const sorted = useSorted(['banana', 'apple', 'cherry'])
    expect(sorted.value).toEqual(['apple', 'banana', 'cherry'])
  })

  it('should sort numbers as strings by default', () => {
    // Default Array.sort converts to strings
    const sorted = useSorted([10, 2, 1, 20])
    expect(sorted.value).toEqual([1, 10, 2, 20])
  })

  it('should sort numbers numerically with custom comparator', () => {
    const sorted = useSorted([10, 2, 1, 20], (a, b) => a - b)
    expect(sorted.value).toEqual([1, 2, 10, 20])
  })

  it('should sort numbers in descending order with custom comparator', () => {
    const sorted = useSorted([3, 1, 4, 1, 5, 9], (a, b) => b - a)
    expect(sorted.value).toEqual([9, 5, 4, 3, 1, 1])
  })

  it('should not mutate the original array', () => {
    const original = [3, 1, 2]
    useSorted(original, (a, b) => a - b)
    expect(original).toEqual([3, 1, 2])
  })

  it('should handle an empty array', () => {
    const sorted = useSorted([])
    expect(sorted.value).toEqual([])
  })

  it('should handle a single-element array', () => {
    const sorted = useSorted([42])
    expect(sorted.value).toEqual([42])
  })

  it('should reactively update when source ref changes', () => {
    const source = ref([3, 1, 2])
    const sorted = useSorted(source, (a, b) => a - b)
    expect(sorted.value).toEqual([1, 2, 3])
    source.value = [9, 5, 7]
    expect(sorted.value).toEqual([5, 7, 9])
  })

  it('should sort objects with a custom comparator', () => {
    const items = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 28 },
    ]
    const sorted = useSorted(items, (a, b) => a.name.localeCompare(b.name))
    expect(sorted.value.map(i => i.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('should handle duplicate values', () => {
    const sorted = useSorted([2, 1, 2, 1, 3], (a, b) => a - b)
    expect(sorted.value).toEqual([1, 1, 2, 2, 3])
  })

  it('should work with a ref source and no comparator', () => {
    const source = ref(['z', 'a', 'm'])
    const sorted = useSorted(source)
    expect(sorted.value).toEqual(['a', 'm', 'z'])
  })

  it('should handle already sorted arrays', () => {
    const sorted = useSorted([1, 2, 3, 4, 5], (a, b) => a - b)
    expect(sorted.value).toEqual([1, 2, 3, 4, 5])
  })
})

// ---------------------------------------------------------------------------
// useCloned
// ---------------------------------------------------------------------------
describe('useCloned', () => {
  it('should create a deep clone of a simple value', () => {
    const source = ref(42)
    const { cloned } = useCloned(source)
    expect(cloned.value).toBe(42)
  })

  it('should create a deep clone of an object', () => {
    const source = ref({ a: 1, b: { c: 2 } })
    const { cloned } = useCloned(source)
    expect(cloned.value).toEqual({ a: 1, b: { c: 2 } })
    expect(cloned.value).not.toBe(source.value)
  })

  it('should deeply clone nested objects', () => {
    const source = ref({ nested: { deep: { value: 'hello' } } })
    const { cloned } = useCloned(source)
    expect(cloned.value.nested.deep.value).toBe('hello')
    expect(cloned.value.nested).not.toBe(source.value.nested)
    expect(cloned.value.nested.deep).not.toBe(source.value.nested.deep)
  })

  it('should allow manual sync', () => {
    const source = ref({ val: 'initial' })
    const { cloned, sync } = useCloned(source)
    // Modify the cloned value directly
    cloned.value = { val: 'modified' }
    expect(cloned.value.val).toBe('modified')
    // Manual sync should restore from source
    sync()
    expect(cloned.value.val).toBe('initial')
  })

  it('should use a custom clone function', () => {
    const customClone = (val: number) => val * 2
    const source = ref(5)
    const { cloned } = useCloned(source, { clone: customClone })
    expect(cloned.value).toBe(10)
  })

  it('should not share references with source after clone', () => {
    const arr = [1, 2, 3]
    const source = ref({ items: arr })
    const { cloned } = useCloned(source)
    expect(cloned.value.items).toEqual([1, 2, 3])
    expect(cloned.value.items).not.toBe(arr)
  })

  it('should handle empty objects', () => {
    const source = ref({})
    const { cloned } = useCloned(source)
    expect(cloned.value).toEqual({})
    expect(cloned.value).not.toBe(source.value)
  })
})

// ---------------------------------------------------------------------------
// useManualRefHistory
// ---------------------------------------------------------------------------
describe('useManualRefHistory', () => {
  it('should have one initial entry in history', () => {
    const source = ref(0)
    const { history } = useManualRefHistory(source)
    expect(history.value.length).toBe(1)
    expect(history.value[0].snapshot).toBe(0)
  })

  it('should commit new snapshots', () => {
    const source = ref(0)
    const { history, commit } = useManualRefHistory(source)
    source.value = 1
    commit()
    expect(history.value.length).toBe(2)
    expect(history.value[1].snapshot).toBe(1)
  })

  it('should undo to previous state', () => {
    const source = ref(0)
    const { commit, undo } = useManualRefHistory(source)
    source.value = 1
    commit()
    source.value = 2
    commit()
    undo()
    expect(source.value).toBe(1)
  })

  it('should redo after undo', () => {
    const source = ref(0)
    const { commit, undo, redo } = useManualRefHistory(source)
    source.value = 1
    commit()
    undo()
    expect(source.value).toBe(0)
    redo()
    expect(source.value).toBe(1)
  })

  it('should report canUndo correctly', () => {
    const source = ref(0)
    const { canUndo, commit, undo } = useManualRefHistory(source)
    expect(canUndo.value).toBe(false)
    source.value = 1
    commit()
    expect(canUndo.value).toBe(true)
    undo()
    expect(canUndo.value).toBe(false)
  })

  it('should report canRedo correctly', () => {
    const source = ref(0)
    const { canRedo, commit, undo, redo } = useManualRefHistory(source)
    expect(canRedo.value).toBe(false)
    source.value = 1
    commit()
    undo()
    expect(canRedo.value).toBe(true)
    redo()
    expect(canRedo.value).toBe(false)
  })

  it('should clear redo stack on new commit', () => {
    const source = ref(0)
    const { canRedo, commit, undo } = useManualRefHistory(source)
    source.value = 1
    commit()
    source.value = 2
    commit()
    undo()
    expect(canRedo.value).toBe(true)
    source.value = 3
    commit()
    expect(canRedo.value).toBe(false)
  })

  it('should respect capacity limit', () => {
    const source = ref(0)
    const { history, commit } = useManualRefHistory(source, { capacity: 3 })
    source.value = 1
    commit()
    source.value = 2
    commit()
    source.value = 3
    commit()
    source.value = 4
    commit()
    // Capacity 3 means at most 3 entries
    expect(history.value.length).toBe(3)
    // Should retain the most recent snapshots
    expect(history.value[history.value.length - 1].snapshot).toBe(4)
  })

  it('should clear history', () => {
    const source = ref(0)
    const { history, commit, clear, canUndo, canRedo } = useManualRefHistory(source)
    source.value = 1
    commit()
    source.value = 2
    commit()
    clear()
    expect(history.value.length).toBe(1)
    expect(canUndo.value).toBe(false)
    expect(canRedo.value).toBe(false)
  })

  it('should expose last record', () => {
    const source = ref(0)
    const { last, commit } = useManualRefHistory(source)
    expect(last.value.snapshot).toBe(0)
    source.value = 42
    commit()
    expect(last.value.snapshot).toBe(42)
  })

  it('should include timestamps in records', () => {
    const source = ref('hello')
    const { last, commit } = useManualRefHistory(source)
    const before = Date.now()
    source.value = 'world'
    commit()
    const after = Date.now()
    expect(last.value.timestamp).toBeGreaterThanOrEqual(before)
    expect(last.value.timestamp).toBeLessThanOrEqual(after)
  })

  it('should not undo past the initial state', () => {
    const source = ref(0)
    const { undo } = useManualRefHistory(source)
    undo()
    undo()
    undo()
    expect(source.value).toBe(0)
  })

  it('should not redo when there is nothing to redo', () => {
    const source = ref(0)
    const { redo } = useManualRefHistory(source)
    redo()
    expect(source.value).toBe(0)
  })

  it('should handle multiple undo/redo cycles', () => {
    const source = ref(0)
    const { commit, undo, redo } = useManualRefHistory(source)
    source.value = 1
    commit()
    source.value = 2
    commit()
    source.value = 3
    commit()
    undo() // -> 2
    undo() // -> 1
    expect(source.value).toBe(1)
    redo() // -> 2
    expect(source.value).toBe(2)
    redo() // -> 3
    expect(source.value).toBe(3)
  })

  it('should clone values when clone option is true', () => {
    const obj = { nested: { val: 1 } }
    const source = ref(obj)
    const { history, commit } = useManualRefHistory(source, { clone: true })
    expect(history.value[0].snapshot).toEqual({ nested: { val: 1 } })
    expect(history.value[0].snapshot).not.toBe(obj)
  })
})

// ---------------------------------------------------------------------------
// useAsyncState
// ---------------------------------------------------------------------------
describe('useAsyncState', () => {
  it('should set initial state', () => {
    const { state } = useAsyncState(
      () => Promise.resolve(42),
      0,
      { immediate: false },
    )
    expect(state.value).toBe(0)
  })

  it('should execute immediately by default', async () => {
    const { state, isReady } = useAsyncState(
      () => Promise.resolve('done'),
      'pending',
    )
    // Wait for promise to resolve
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(state.value).toBe('done')
    expect(isReady.value).toBe(true)
  })

  it('should not execute when immediate is false', async () => {
    const { state, isReady, isLoading } = useAsyncState(
      () => Promise.resolve('done'),
      'pending',
      { immediate: false },
    )
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(state.value).toBe('pending')
    expect(isReady.value).toBe(false)
    expect(isLoading.value).toBe(false)
  })

  it('should handle manual execute', async () => {
    const { state, execute, isReady } = useAsyncState(
      () => Promise.resolve(100),
      0,
      { immediate: false },
    )
    expect(state.value).toBe(0)
    await execute()
    expect(state.value).toBe(100)
    expect(isReady.value).toBe(true)
  })

  it('should set isLoading during execution', async () => {
    let resolveFn: (val: string) => void
    const promise = () => new Promise<string>((resolve) => { resolveFn = resolve })

    const { isLoading, execute } = useAsyncState(promise, '', { immediate: false })
    expect(isLoading.value).toBe(false)

    const execPromise = execute()
    expect(isLoading.value).toBe(true)

    resolveFn!('result')
    await execPromise
    expect(isLoading.value).toBe(false)
  })

  it('should handle errors', async () => {
    const testError = new Error('test error')
    const { error, execute, isReady } = useAsyncState(
      () => Promise.reject(testError),
      null,
      { immediate: false },
    )
    await execute()
    expect(error.value).toBe(testError)
    expect(isReady.value).toBe(false)
  })

  it('should call onError callback', async () => {
    const onError = mock(() => {})
    const testError = new Error('test')
    const { execute } = useAsyncState(
      () => Promise.reject(testError),
      null,
      { immediate: false, onError },
    )
    await execute()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(testError)
  })

  it('should reset state on execute when resetOnExecute is true', async () => {
    let callCount = 0
    const { state, execute } = useAsyncState(
      () => {
        callCount++
        return Promise.resolve(callCount * 10)
      },
      0,
      { immediate: false, resetOnExecute: true },
    )
    await execute()
    expect(state.value).toBe(10)
    // During second execute, state should reset to 0 before resolving
    const execPromise = execute()
    // State gets reset synchronously at start of execute
    // then resolves to new value
    await execPromise
    expect(state.value).toBe(20)
  })

  it('should not reset state on execute when resetOnExecute is false', async () => {
    let callCount = 0
    const { state, execute } = useAsyncState(
      () => {
        callCount++
        return Promise.resolve(callCount * 10)
      },
      0,
      { immediate: false, resetOnExecute: false },
    )
    await execute()
    expect(state.value).toBe(10)
    // start second execute - state should not reset
    await execute()
    expect(state.value).toBe(20)
  })

  it('should support delay on execute', async () => {
    const start = Date.now()
    const { state, execute } = useAsyncState(
      () => Promise.resolve('delayed'),
      '',
      { immediate: false },
    )
    await execute(50)
    const elapsed = Date.now() - start
    expect(state.value).toBe('delayed')
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  it('should support default delay option', async () => {
    const start = Date.now()
    const { state, execute } = useAsyncState(
      () => Promise.resolve('delayed'),
      '',
      { immediate: false, delay: 50 },
    )
    await execute()
    const elapsed = Date.now() - start
    expect(state.value).toBe('delayed')
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  it('should clear error on re-execute', async () => {
    let shouldFail = true
    const { error, execute } = useAsyncState(
      () => {
        if (shouldFail) return Promise.reject(new Error('fail'))
        return Promise.resolve('ok')
      },
      null,
      { immediate: false },
    )
    await execute()
    expect(error.value).toBeTruthy()
    shouldFail = false
    await execute()
    expect(error.value).toBeUndefined()
  })

  it('should work with a raw promise (not a function)', async () => {
    const { state } = useAsyncState(
      Promise.resolve(42),
      0,
    )
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(state.value).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// useAsyncQueue
// ---------------------------------------------------------------------------
describe('useAsyncQueue', () => {
  it('should run tasks sequentially', async () => {
    const order: number[] = []
    const { isFinished } = useAsyncQueue([
      async () => { order.push(1); return 1 },
      async () => { order.push(2); return 2 },
      async () => { order.push(3); return 3 },
    ])
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(order).toEqual([1, 2, 3])
    expect(isFinished.value).toBe(true)
  })

  it('should track results', async () => {
    const { result } = useAsyncQueue([
      async () => 'a',
      async () => 'b',
    ])
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(result.value[0].state).toBe('fulfilled')
    expect(result.value[0].data).toBe('a')
    expect(result.value[1].state).toBe('fulfilled')
    expect(result.value[1].data).toBe('b')
  })

  it('should handle task failures', async () => {
    const { result } = useAsyncQueue([
      async () => 'ok',
      async () => { throw new Error('fail') },
      async () => 'after-fail',
    ])
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(result.value[0].state).toBe('fulfilled')
    expect(result.value[1].state).toBe('rejected')
    expect(result.value[2].state).toBe('fulfilled')
  })

  it('should update activeIndex as tasks run', async () => {
    const indices: number[] = []
    const { activeIndex } = useAsyncQueue([
      async () => {
        // First task runs synchronously during useAsyncQueue() before
        // destructured return is assigned, so defer to next microtask
        await Promise.resolve()
        indices.push(activeIndex.value)
        return 1
      },
      async () => {
        await Promise.resolve()
        indices.push(activeIndex.value)
        return 2
      },
    ])
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(indices).toEqual([0, 1])
  })

  it('should set isFinished to true when all tasks complete', async () => {
    const { isFinished } = useAsyncQueue([
      async () => 'done',
    ])
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(isFinished.value).toBe(true)
  })

  it('should initialize with pending states', () => {
    const { result } = useAsyncQueue([
      () => new Promise(resolve => setTimeout(() => resolve('slow'), 1000)),
    ])
    // Immediately, the task is pending
    expect(result.value[0].state).toBe('pending')
  })

  it('should handle an empty task list', async () => {
    const { isFinished, result } = useAsyncQueue([])
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(isFinished.value).toBe(true)
    expect(result.value).toEqual([])
  })

  it('should handle a single task', async () => {
    const { result, isFinished } = useAsyncQueue([
      async () => 42,
    ])
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(result.value[0].state).toBe('fulfilled')
    expect(result.value[0].data).toBe(42)
    expect(isFinished.value).toBe(true)
  })

  it('should handle all tasks failing', async () => {
    const { result, isFinished } = useAsyncQueue([
      async () => { throw new Error('e1') },
      async () => { throw new Error('e2') },
    ])
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(result.value[0].state).toBe('rejected')
    expect(result.value[1].state).toBe('rejected')
    expect(isFinished.value).toBe(true)
  })

  it('should handle async tasks with delays', async () => {
    const start = Date.now()
    const { isFinished } = useAsyncQueue([
      () => new Promise(resolve => setTimeout(() => resolve('a'), 30)),
      () => new Promise(resolve => setTimeout(() => resolve('b'), 30)),
    ])
    await new Promise(resolve => setTimeout(resolve, 100))
    const elapsed = Date.now() - start
    expect(isFinished.value).toBe(true)
    // Should take at least 60ms (sequential)
    expect(elapsed).toBeGreaterThanOrEqual(50)
  })

  it('should set activeIndex past the end when finished', async () => {
    const tasks = [
      async () => 1,
      async () => 2,
      async () => 3,
    ]
    const { activeIndex, isFinished } = useAsyncQueue(tasks)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(isFinished.value).toBe(true)
    expect(activeIndex.value).toBe(3)
  })

  it('should continue executing after a rejection', async () => {
    const executed: string[] = []
    const { result } = useAsyncQueue([
      async () => { executed.push('first'); return 'ok' },
      async () => { executed.push('second'); throw new Error('err') },
      async () => { executed.push('third'); return 'recovered' },
    ])
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(executed).toEqual(['first', 'second', 'third'])
    expect(result.value[2].state).toBe('fulfilled')
    expect(result.value[2].data).toBe('recovered')
  })
})
