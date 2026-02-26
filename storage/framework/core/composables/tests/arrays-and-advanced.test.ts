import { describe, expect, it, mock } from 'bun:test'
import { ref } from '@stacksjs/stx'
import {
  useArrayDifference,
  useArrayEvery,
  useArrayFilter,
  useArrayFind,
  useArrayFindIndex,
  useArrayIncludes,
  useArrayMap,
  useArrayReduce,
  useArraySome,
  useArrayUnique,
} from '../src/useArrayUtils'
import { useOffsetPagination } from '../src/useOffsetPagination'
import { useVirtualList } from '../src/useVirtualList'
import { TransitionPresets, useTransition } from '../src/useTransition'
import { useDebouncedRefHistory } from '../src/useDebouncedRefHistory'
import { useThrottledRefHistory } from '../src/useThrottledRefHistory'
import { useTimeoutPoll } from '../src/useTimeoutPoll'
import { useMounted } from '../src/useMounted'

// ===========================================================================
// useArrayDifference
// ===========================================================================
describe('useArrayDifference', () => {
  it('should return items in first array but not in second', () => {
    const result = useArrayDifference([1, 2, 3, 4, 5], [3, 4, 5, 6, 7])
    expect(result.value).toEqual([1, 2])
  })

  it('should return all items when there is no overlap', () => {
    const result = useArrayDifference([1, 2, 3], [4, 5, 6])
    expect(result.value).toEqual([1, 2, 3])
  })

  it('should return empty array when all items are in second array', () => {
    const result = useArrayDifference([1, 2, 3], [1, 2, 3, 4])
    expect(result.value).toEqual([])
  })

  it('should return empty array when first array is empty', () => {
    const result = useArrayDifference([], [1, 2, 3])
    expect(result.value).toEqual([])
  })

  it('should return all items when second array is empty', () => {
    const result = useArrayDifference([1, 2, 3], [])
    expect(result.value).toEqual([1, 2, 3])
  })

  it('should support a custom compareFn', () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const other = [{ id: 2 }, { id: 4 }]
    const result = useArrayDifference(list, other, (a, b) => a.id === b.id)
    expect(result.value).toEqual([{ id: 1 }, { id: 3 }])
  })

})

// ===========================================================================
// useArrayEvery
// ===========================================================================
describe('useArrayEvery', () => {
  it('should return true when all elements match', () => {
    const result = useArrayEvery([2, 4, 6, 8], n => n % 2 === 0)
    expect(result.value).toBe(true)
  })

  it('should return false when no elements match', () => {
    const result = useArrayEvery([1, 3, 5, 7], n => n % 2 === 0)
    expect(result.value).toBe(false)
  })

  it('should return false when only some elements match', () => {
    const result = useArrayEvery([2, 3, 4, 6], n => n % 2 === 0)
    expect(result.value).toBe(false)
  })

  it('should return true for an empty array', () => {
    const result = useArrayEvery([], () => false)
    expect(result.value).toBe(true)
  })

  it('should provide index to predicate', () => {
    const indices: number[] = []
    useArrayEvery([10, 20, 30], (_el, index) => {
      indices.push(index)
      return true
    })
    expect(indices).toEqual([0, 1, 2])
  })

  it('should return true for a single matching element', () => {
    const result = useArrayEvery([42], n => n === 42)
    expect(result.value).toBe(true)
  })
})

// ===========================================================================
// useArrayFilter
// ===========================================================================
describe('useArrayFilter', () => {
  it('should filter elements based on predicate', () => {
    const result = useArrayFilter([1, 2, 3, 4, 5, 6], n => n % 2 === 0)
    expect(result.value).toEqual([2, 4, 6])
  })

  it('should return empty array when no elements match', () => {
    const result = useArrayFilter([1, 3, 5], n => n % 2 === 0)
    expect(result.value).toEqual([])
  })

  it('should return all elements when all match', () => {
    const result = useArrayFilter([2, 4, 6], n => n % 2 === 0)
    expect(result.value).toEqual([2, 4, 6])
  })

  it('should return empty array for empty input', () => {
    const result = useArrayFilter([], () => true)
    expect(result.value).toEqual([])
  })

  it('should filter objects by property', () => {
    const items = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 17 },
      { name: 'Charlie', age: 25 },
    ]
    const result = useArrayFilter(items, item => item.age >= 18)
    expect(result.value).toEqual([
      { name: 'Alice', age: 30 },
      { name: 'Charlie', age: 25 },
    ])
  })

  it('should provide index to the predicate', () => {
    const result = useArrayFilter(['a', 'b', 'c', 'd'], (_el, idx) => idx % 2 === 0)
    expect(result.value).toEqual(['a', 'c'])
  })
})

// ===========================================================================
// useArrayFind
// ===========================================================================
describe('useArrayFind', () => {
  it('should find the first matching element', () => {
    const result = useArrayFind([1, 2, 3, 4, 5], n => n > 3)
    expect(result.value).toBe(4)
  })

  it('should return undefined when no element matches', () => {
    const result = useArrayFind([1, 2, 3], n => n > 10)
    expect(result.value).toBeUndefined()
  })

  it('should return the first match even if multiple match', () => {
    const result = useArrayFind([10, 20, 30], n => n >= 10)
    expect(result.value).toBe(10)
  })

  it('should return undefined for empty array', () => {
    const result = useArrayFind([], () => true)
    expect(result.value).toBeUndefined()
  })

  it('should find objects by property', () => {
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]
    const result = useArrayFind(users, u => u.name === 'Bob')
    expect(result.value).toEqual({ id: 2, name: 'Bob' })
  })

})

// ===========================================================================
// useArrayFindIndex
// ===========================================================================
describe('useArrayFindIndex', () => {
  it('should return the index of the first matching element', () => {
    const result = useArrayFindIndex([10, 20, 30, 40], n => n === 30)
    expect(result.value).toBe(2)
  })

  it('should return -1 when no element matches', () => {
    const result = useArrayFindIndex([1, 2, 3], n => n === 99)
    expect(result.value).toBe(-1)
  })

  it('should return 0 when the first element matches', () => {
    const result = useArrayFindIndex([5, 10, 15], n => n === 5)
    expect(result.value).toBe(0)
  })

  it('should return -1 for empty array', () => {
    const result = useArrayFindIndex([], () => true)
    expect(result.value).toBe(-1)
  })

  it('should return the first matching index when duplicates exist', () => {
    const result = useArrayFindIndex([1, 2, 3, 2, 1], n => n === 2)
    expect(result.value).toBe(1)
  })

})

// ===========================================================================
// useArrayIncludes
// ===========================================================================
describe('useArrayIncludes', () => {
  it('should return true when value is included', () => {
    const result = useArrayIncludes([1, 2, 3, 4, 5], 3)
    expect(result.value).toBe(true)
  })

  it('should return false when value is not included', () => {
    const result = useArrayIncludes([1, 2, 3], 99)
    expect(result.value).toBe(false)
  })

  it('should return false for empty array', () => {
    const result = useArrayIncludes([], 1)
    expect(result.value).toBe(false)
  })

  it('should support a custom compareFn', () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = useArrayIncludes(list, { id: 2 }, (a, b) => a.id === b.id)
    expect(result.value).toBe(true)
  })

  it('should return false with custom compareFn when not found', () => {
    const list = [{ id: 1 }, { id: 2 }]
    const result = useArrayIncludes(list, { id: 99 }, (a, b) => a.id === b.id)
    expect(result.value).toBe(false)
  })

  it('should handle string arrays', () => {
    const result = useArrayIncludes(['hello', 'world'], 'hello')
    expect(result.value).toBe(true)
  })
})

// ===========================================================================
// useArrayMap
// ===========================================================================
describe('useArrayMap', () => {
  it('should map elements with the given function', () => {
    const result = useArrayMap([1, 2, 3], n => n * 2)
    expect(result.value).toEqual([2, 4, 6])
  })

  it('should return empty array for empty input', () => {
    const result = useArrayMap([], (n: number) => n * 2)
    expect(result.value).toEqual([])
  })

  it('should map to different types', () => {
    const result = useArrayMap([1, 2, 3], n => String(n))
    expect(result.value).toEqual(['1', '2', '3'])
  })

  it('should provide index to mapping function', () => {
    const result = useArrayMap(['a', 'b', 'c'], (el, idx) => `${idx}:${el}`)
    expect(result.value).toEqual(['0:a', '1:b', '2:c'])
  })

  it('should map objects to extracted properties', () => {
    const users = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]
    const result = useArrayMap(users, u => u.name)
    expect(result.value).toEqual(['Alice', 'Bob'])
  })

  it('should map single element arrays', () => {
    const result = useArrayMap([42], n => n + 1)
    expect(result.value).toEqual([43])
  })
})

// ===========================================================================
// useArrayReduce
// ===========================================================================
describe('useArrayReduce', () => {
  it('should sum numbers', () => {
    const result = useArrayReduce([1, 2, 3, 4, 5], (acc, n) => acc + n, 0)
    expect(result.value).toBe(15)
  })

  it('should concatenate strings', () => {
    const result = useArrayReduce(['a', 'b', 'c'], (acc, s) => acc + s, '')
    expect(result.value).toBe('abc')
  })

  it('should return initial value for empty array', () => {
    const result = useArrayReduce([], (acc: number, n: number) => acc + n, 0)
    expect(result.value).toBe(0)
  })

  it('should compute product of numbers', () => {
    const result = useArrayReduce([2, 3, 4], (acc, n) => acc * n, 1)
    expect(result.value).toBe(24)
  })

  it('should build an object from array entries', () => {
    const entries: [string, number][] = [['a', 1], ['b', 2], ['c', 3]]
    const result = useArrayReduce(
      entries,
      (acc, [key, val]) => ({ ...acc, [key]: val }),
      {} as Record<string, number>,
    )
    expect(result.value).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('should count items that match a condition', () => {
    const result = useArrayReduce(
      [1, 2, 3, 4, 5, 6],
      (acc, n) => n % 2 === 0 ? acc + 1 : acc,
      0,
    )
    expect(result.value).toBe(3)
  })

  it('should find max value', () => {
    const result = useArrayReduce([3, 1, 4, 1, 5, 9, 2, 6], (acc, n) => Math.max(acc, n), -Infinity)
    expect(result.value).toBe(9)
  })
})

// ===========================================================================
// useArraySome
// ===========================================================================
describe('useArraySome', () => {
  it('should return true when at least one element matches', () => {
    const result = useArraySome([1, 2, 3, 4], n => n > 3)
    expect(result.value).toBe(true)
  })

  it('should return false when no elements match', () => {
    const result = useArraySome([1, 2, 3], n => n > 10)
    expect(result.value).toBe(false)
  })

  it('should return false for empty array', () => {
    const result = useArraySome([], () => true)
    expect(result.value).toBe(false)
  })

  it('should return true when all elements match', () => {
    const result = useArraySome([2, 4, 6], n => n % 2 === 0)
    expect(result.value).toBe(true)
  })

  it('should handle single element that matches', () => {
    const result = useArraySome([42], n => n === 42)
    expect(result.value).toBe(true)
  })

  it('should handle single element that does not match', () => {
    const result = useArraySome([1], n => n === 42)
    expect(result.value).toBe(false)
  })

  it('should provide index to predicate', () => {
    const result = useArraySome([10, 20, 30], (_el, idx) => idx === 2)
    expect(result.value).toBe(true)
  })
})

// ===========================================================================
// useArrayUnique
// ===========================================================================
describe('useArrayUnique', () => {
  it('should remove duplicate primitive values', () => {
    const result = useArrayUnique([1, 2, 2, 3, 3, 3, 4])
    expect(result.value).toEqual([1, 2, 3, 4])
  })

  it('should return the same array when already unique', () => {
    const result = useArrayUnique([1, 2, 3, 4, 5])
    expect(result.value).toEqual([1, 2, 3, 4, 5])
  })

  it('should handle empty array', () => {
    const result = useArrayUnique([])
    expect(result.value).toEqual([])
  })

  it('should handle single element', () => {
    const result = useArrayUnique([42])
    expect(result.value).toEqual([42])
  })

  it('should handle all duplicates', () => {
    const result = useArrayUnique([1, 1, 1, 1])
    expect(result.value).toEqual([1])
  })

  it('should support custom compareFn for objects', () => {
    const items = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 1, name: 'Alice copy' },
      { id: 3, name: 'Charlie' },
    ]
    const result = useArrayUnique(items, (a, b) => a.id === b.id)
    expect(result.value).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ])
  })

  it('should handle string duplicates', () => {
    const result = useArrayUnique(['hello', 'world', 'hello', 'foo', 'world'])
    expect(result.value).toEqual(['hello', 'world', 'foo'])
  })
})

// ===========================================================================
// useOffsetPagination
// ===========================================================================
describe('useOffsetPagination', () => {
  it('should initialize with default values', () => {
    const { currentPage, currentPageSize, pageCount, isFirstPage, isLastPage } = useOffsetPagination()
    expect(currentPage.value).toBe(1)
    expect(currentPageSize.value).toBe(10)
    expect(pageCount.value).toBe(1)
    expect(isFirstPage.value).toBe(true)
    expect(isLastPage.value).toBe(true)
  })

  it('should compute correct page count', () => {
    const { pageCount } = useOffsetPagination({ total: 50, pageSize: 10 })
    expect(pageCount.value).toBe(5)
  })

  it('should compute page count rounding up for remainder', () => {
    const { pageCount } = useOffsetPagination({ total: 53, pageSize: 10 })
    expect(pageCount.value).toBe(6)
  })

  it('should not go below page 1 with prev', () => {
    const { currentPage, prev } = useOffsetPagination({ total: 50, pageSize: 10 })
    expect(currentPage.value).toBe(1)
    prev()
    expect(currentPage.value).toBe(1)
  })

  it('should start on a custom page', () => {
    const { currentPage } = useOffsetPagination({ total: 50, pageSize: 10, page: 3 })
    expect(currentPage.value).toBe(3)
  })

})

// ===========================================================================
// useVirtualList
// ===========================================================================
describe('useVirtualList', () => {
  it('should initialize with items from the source', () => {
    const items = Array.from({ length: 100 }, (_, i) => `item-${i}`)
    const { list } = useVirtualList(items, { itemHeight: 30 })
    expect(list.value.length).toBeGreaterThan(0)
  })

  it('should include index and data in list items', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const { list } = useVirtualList(items, { itemHeight: 30 })
    for (const item of list.value) {
      expect(item).toHaveProperty('data')
      expect(item).toHaveProperty('index')
      expect(typeof item.index).toBe('number')
    }
  })

  it('should have container props with overflow and position styles', () => {
    const items = [1, 2, 3]
    const { containerProps } = useVirtualList(items, { itemHeight: 20 })
    expect(containerProps.style.overflow).toBe('auto')
    expect(containerProps.style.position).toBe('relative')
    expect(typeof containerProps.onScroll).toBe('function')
  })

  it('should have wrapper props with height and marginTop styles', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const { wrapperProps } = useVirtualList(items, { itemHeight: 20 })
    expect(wrapperProps.value.style).toHaveProperty('height')
    expect(wrapperProps.value.style).toHaveProperty('marginTop')
    expect(wrapperProps.value.style).toHaveProperty('width')
  })

  it('should update list on scrollTo', () => {
    const items = Array.from({ length: 1000 }, (_, i) => `item-${i}`)
    const { list, scrollTo } = useVirtualList(items, { itemHeight: 30 })
    const initialFirst = list.value[0]?.index ?? 0
    scrollTo(500)
    const afterScrollFirst = list.value[0]?.index ?? 0
    expect(afterScrollFirst).toBeGreaterThan(initialFirst)
  })

  it('should handle empty source array', () => {
    const { list } = useVirtualList([], { itemHeight: 30 })
    expect(list.value).toEqual([])
  })

  it('should respect overscan option', () => {
    const items = Array.from({ length: 100 }, (_, i) => i)
    const { list: listSmallOverscan } = useVirtualList(items, { itemHeight: 30, overscan: 2 })
    const { list: listLargeOverscan } = useVirtualList(items, { itemHeight: 30, overscan: 20 })
    // With more overscan, more items should be rendered
    expect(listLargeOverscan.value.length).toBeGreaterThanOrEqual(listSmallOverscan.value.length)
  })

})

// ===========================================================================
// useTransition / TransitionPresets
// ===========================================================================
describe('useTransition / TransitionPresets', () => {
  it('should export all standard TransitionPresets', () => {
    expect(TransitionPresets).toHaveProperty('linear')
    expect(TransitionPresets).toHaveProperty('easeInQuad')
    expect(TransitionPresets).toHaveProperty('easeOutQuad')
    expect(TransitionPresets).toHaveProperty('easeInOutQuad')
    expect(TransitionPresets).toHaveProperty('easeInCubic')
    expect(TransitionPresets).toHaveProperty('easeOutCubic')
    expect(TransitionPresets).toHaveProperty('easeInOutCubic')
  })

  it('linear preset should return identity', () => {
    expect(TransitionPresets.linear(0)).toBe(0)
    expect(TransitionPresets.linear(0.5)).toBe(0.5)
    expect(TransitionPresets.linear(1)).toBe(1)
  })

  it('easeInQuad should start slow and end fast', () => {
    const midpoint = TransitionPresets.easeInQuad(0.5)
    expect(midpoint).toBeLessThan(0.5)
    expect(TransitionPresets.easeInQuad(0)).toBe(0)
    expect(TransitionPresets.easeInQuad(1)).toBe(1)
  })

  it('easeOutQuad should start fast and end slow', () => {
    const midpoint = TransitionPresets.easeOutQuad(0.5)
    expect(midpoint).toBeGreaterThan(0.5)
    expect(TransitionPresets.easeOutQuad(0)).toBe(0)
    expect(TransitionPresets.easeOutQuad(1)).toBe(1)
  })

  it('easeInOutQuad should be symmetric around 0.5', () => {
    expect(TransitionPresets.easeInOutQuad(0)).toBe(0)
    expect(TransitionPresets.easeInOutQuad(1)).toBe(1)
    expect(TransitionPresets.easeInOutQuad(0.5)).toBe(0.5)
  })

  it('easeInCubic should return t^3', () => {
    expect(TransitionPresets.easeInCubic(0)).toBe(0)
    expect(TransitionPresets.easeInCubic(0.5)).toBeCloseTo(0.125, 5)
    expect(TransitionPresets.easeInCubic(1)).toBe(1)
  })

  it('easeOutCubic should end at 1', () => {
    expect(TransitionPresets.easeOutCubic(0)).toBe(0)
    expect(TransitionPresets.easeOutCubic(1)).toBe(1)
    // At midpoint, should be past 0.5 (fast start)
    expect(TransitionPresets.easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })

  it('useTransition should return a ref initialized to the source value', () => {
    const output = useTransition(42)
    expect(output.value).toBe(42)
  })

  it('useTransition should initialize from a ref source', () => {
    const source = ref(100)
    const output = useTransition(source)
    expect(output.value).toBe(100)
  })

  it('all presets should be functions returning numbers', () => {
    for (const [name, fn] of Object.entries(TransitionPresets)) {
      expect(typeof fn).toBe('function')
      const result = fn(0.5)
      expect(typeof result).toBe('number')
    }
  })
})

// ===========================================================================
// useDebouncedRefHistory
// ===========================================================================
describe('useDebouncedRefHistory', () => {
  it('should initialize with one history entry (the initial commit)', () => {
    const source = ref(0)
    const { history } = useDebouncedRefHistory(source)
    expect(history.value.length).toBe(1)
    expect(history.value[0].snapshot).toBe(0)
  })

})

// ===========================================================================
// useThrottledRefHistory
// ===========================================================================
describe('useThrottledRefHistory', () => {
  it('should initialize with one history entry (the initial commit)', () => {
    const source = ref(0)
    const { history } = useThrottledRefHistory(source)
    expect(history.value.length).toBe(1)
    expect(history.value[0].snapshot).toBe(0)
  })

})

// ===========================================================================
// useTimeoutPoll
// ===========================================================================
describe('useTimeoutPoll', () => {
  it('should start polling immediately by default', () => {
    const fn = mock(() => {})
    const { isActive, pause } = useTimeoutPoll(fn, 100)
    expect(isActive.value).toBe(true)
    pause()
  })

  it('should not start immediately when immediate is false', () => {
    const fn = mock(() => {})
    const { isActive } = useTimeoutPoll(fn, 100, { immediate: false })
    expect(isActive.value).toBe(false)
  })

  it('should call the function at least once when started', async () => {
    const fn = mock(() => {})
    const { pause } = useTimeoutPoll(fn, 10)
    await new Promise(resolve => setTimeout(resolve, 50))
    pause()
    expect(fn).toHaveBeenCalled()
  })

  it('should call the function multiple times over time', async () => {
    const fn = mock(() => {})
    const { pause } = useTimeoutPoll(fn, 20)
    await new Promise(resolve => setTimeout(resolve, 150))
    pause()
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('should pause polling', async () => {
    const fn = mock(() => {})
    const { pause, isActive } = useTimeoutPoll(fn, 20)
    await new Promise(resolve => setTimeout(resolve, 30))
    pause()
    expect(isActive.value).toBe(false)
    const callCount = fn.mock.calls.length
    await new Promise(resolve => setTimeout(resolve, 100))
    // No additional calls after pause
    expect(fn.mock.calls.length).toBe(callCount)
  })

  it('should resume polling after pause', async () => {
    const fn = mock(() => {})
    const { pause, resume, isActive } = useTimeoutPoll(fn, 20)
    await new Promise(resolve => setTimeout(resolve, 30))
    pause()
    const callCountAfterPause = fn.mock.calls.length
    resume()
    expect(isActive.value).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 100))
    pause()
    expect(fn.mock.calls.length).toBeGreaterThan(callCountAfterPause)
  })

  it('should not double-start when resume is called while active', () => {
    const fn = mock(() => {})
    const { isActive, resume, pause } = useTimeoutPoll(fn, 100)
    expect(isActive.value).toBe(true)
    resume() // Should be a no-op since already active
    expect(isActive.value).toBe(true)
    pause()
  })

  it('should handle async poll functions', async () => {
    let counter = 0
    const fn = async () => {
      await new Promise(resolve => setTimeout(resolve, 5))
      counter++
    }
    const { pause } = useTimeoutPoll(fn, 20)
    await new Promise(resolve => setTimeout(resolve, 150))
    pause()
    expect(counter).toBeGreaterThanOrEqual(2)
  })

  it('should continue polling even if fn throws', async () => {
    let counter = 0
    const fn = () => {
      counter++
      if (counter === 1) throw new Error('test error')
    }
    const { pause } = useTimeoutPoll(fn, 20)
    await new Promise(resolve => setTimeout(resolve, 150))
    pause()
    expect(counter).toBeGreaterThanOrEqual(2)
  })
})

// ===========================================================================
// useMounted
// ===========================================================================
describe('useMounted', () => {
  it('should return a ref that is initially false', () => {
    const isMounted = useMounted()
    expect(isMounted.value).toBe(false)
  })

  it('should become true after microtask', async () => {
    const isMounted = useMounted()
    expect(isMounted.value).toBe(false)
    await Promise.resolve()
    expect(isMounted.value).toBe(true)
  })

  it('should be true after awaiting a short delay', async () => {
    const isMounted = useMounted()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(isMounted.value).toBe(true)
  })

  it('should return a ref object with value property', () => {
    const isMounted = useMounted()
    expect(isMounted).toHaveProperty('value')
    expect(typeof isMounted.value).toBe('boolean')
  })

  it('should have subscribe method on the returned ref', () => {
    const isMounted = useMounted()
    expect(typeof isMounted.subscribe).toBe('function')
  })

  it('should notify subscribers when mounted', async () => {
    const isMounted = useMounted()
    let notified = false
    isMounted.subscribe((newVal: boolean) => {
      if (newVal) notified = true
    })
    await Promise.resolve()
    expect(notified).toBe(true)
  })

  it('should return independent refs for multiple calls', async () => {
    const mounted1 = useMounted()
    const mounted2 = useMounted()
    expect(mounted1).not.toBe(mounted2)
    await Promise.resolve()
    expect(mounted1.value).toBe(true)
    expect(mounted2.value).toBe(true)
  })

  it('should transition from false to true exactly once', async () => {
    const isMounted = useMounted()
    const transitions: boolean[] = []
    isMounted.subscribe((val: boolean) => {
      transitions.push(val)
    })
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 50))
    // Only one transition: false -> true
    expect(transitions).toEqual([true])
  })
})
