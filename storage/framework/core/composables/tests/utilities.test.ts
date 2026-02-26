import { describe, expect, it, mock } from 'bun:test'
import { ref } from '@stacksjs/stx'
import { isDefined } from '../src/isDefined'
import { refDefault } from '../src/refDefault'
import { refAutoReset, autoResetRef } from '../src/refAutoReset'
import { cloneFnJSON } from '../src/cloneFnJSON'
import { useToNumber } from '../src/useToNumber'
import { useToString } from '../src/useToString'
import { useSupported } from '../src/useSupported'
import { createEventHook } from '../src/createEventHook'
import { createGlobalState } from '../src/createGlobalState'
import { createSharedComposable } from '../src/createSharedComposable'
import { makeDestructurable } from '../src/makeDestructurable'
import { until } from '../src/until'
import { syncRef, syncRefs } from '../src/syncRef'
import { useMemoize } from '../src/useMemoize'
import { useConfirmDialog } from '../src/useConfirmDialog'
import { useEventBus } from '../src/useEventBus'

// ---------------------------------------------------------------------------
// isDefined
// ---------------------------------------------------------------------------
describe('isDefined', () => {
  it('should return false for a ref containing null', () => {
    const r = ref<string | null>(null)
    expect(isDefined(r)).toBe(false)
  })

  it('should return false for a ref containing undefined', () => {
    const r = ref<string | undefined>(undefined)
    expect(isDefined(r)).toBe(false)
  })

  it('should return true for a ref containing a string', () => {
    const r = ref<string | null>('hello')
    expect(isDefined(r)).toBe(true)
  })

  it('should return true for a ref containing a number', () => {
    const r = ref<number | null>(42)
    expect(isDefined(r)).toBe(true)
  })

  it('should return true for a ref containing zero', () => {
    const r = ref<number | null>(0)
    expect(isDefined(r)).toBe(true)
  })

  it('should return true for a ref containing an empty string', () => {
    const r = ref<string | null>('')
    expect(isDefined(r)).toBe(true)
  })

  it('should return true for a ref containing false', () => {
    const r = ref<boolean | null>(false)
    expect(isDefined(r)).toBe(true)
  })

  it('should return true for a ref containing an empty object', () => {
    const r = ref<object | null>({})
    expect(isDefined(r)).toBe(true)
  })

  it('should return true for a ref containing an empty array', () => {
    const r = ref<any[] | null>([])
    expect(isDefined(r)).toBe(true)
  })

  it('should reflect changes when ref value changes from null to defined', () => {
    const r = ref<string | null>(null)
    expect(isDefined(r)).toBe(false)
    r.value = 'now defined'
    expect(isDefined(r)).toBe(true)
  })

  it('should reflect changes when ref value changes from defined to null', () => {
    const r = ref<string | null>('defined')
    expect(isDefined(r)).toBe(true)
    r.value = null
    expect(isDefined(r)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// refDefault
// ---------------------------------------------------------------------------
describe('refDefault', () => {
  it('should return the default when source is null', () => {
    const source = ref<string | null>(null)
    const result = refDefault(source, 'fallback')
    expect(result.value).toBe('fallback')
  })

  it('should return the default when source is undefined', () => {
    const source = ref<string | undefined>(undefined)
    const result = refDefault(source, 'fallback')
    expect(result.value).toBe('fallback')
  })

  it('should return the source value when it is defined', () => {
    const source = ref<string | null>('hello')
    const result = refDefault(source, 'fallback')
    expect(result.value).toBe('hello')
  })

  it('should not apply default when source is zero', () => {
    const source = ref<number | null>(0)
    const result = refDefault(source, 99)
    expect(result.value).toBe(0)
  })

  it('should not apply default when source is empty string', () => {
    const source = ref<string | null>('')
    const result = refDefault(source, 'fallback')
    expect(result.value).toBe('')
  })

})

// ---------------------------------------------------------------------------
// refAutoReset / autoResetRef
// ---------------------------------------------------------------------------
describe('refAutoReset', () => {
  it('should initialize with the default value', () => {
    const val = refAutoReset('initial', 100)
    expect(val.value).toBe('initial')
  })

  it('autoResetRef should be an alias for refAutoReset', () => {
    expect(autoResetRef).toBe(refAutoReset)
  })
})

// ---------------------------------------------------------------------------
// cloneFnJSON
// ---------------------------------------------------------------------------
describe('cloneFnJSON', () => {
  it('should clone a simple object', () => {
    const obj = { a: 1, b: 'hello' }
    const clone = cloneFnJSON(obj)
    expect(clone).toEqual(obj)
    expect(clone).not.toBe(obj)
  })

  it('should deep clone nested objects', () => {
    const obj = { nested: { deep: { value: 42 } } }
    const clone = cloneFnJSON(obj)
    expect(clone).toEqual(obj)
    expect(clone.nested).not.toBe(obj.nested)
    expect(clone.nested.deep).not.toBe(obj.nested.deep)
  })

  it('should clone arrays', () => {
    const arr = [1, 2, 3, [4, 5]]
    const clone = cloneFnJSON(arr)
    expect(clone).toEqual(arr)
    expect(clone).not.toBe(arr)
    expect(clone[3]).not.toBe(arr[3])
  })

  it('should clone primitive numbers', () => {
    const clone = cloneFnJSON(42)
    expect(clone).toBe(42)
  })

  it('should clone primitive strings', () => {
    const clone = cloneFnJSON('hello')
    expect(clone).toBe('hello')
  })

  it('should clone booleans', () => {
    expect(cloneFnJSON(true)).toBe(true)
    expect(cloneFnJSON(false)).toBe(false)
  })

  it('should clone null', () => {
    expect(cloneFnJSON(null)).toBeNull()
  })

  it('should strip undefined values in objects', () => {
    const obj = { a: 1, b: undefined }
    const clone = cloneFnJSON(obj)
    expect(clone).toEqual({ a: 1 })
    expect('b' in clone).toBe(false)
  })

  it('should convert undefined array elements to null', () => {
    const arr = [1, undefined, 3]
    const clone = cloneFnJSON(arr)
    expect(clone).toEqual([1, null, 3])
  })

  it('should clone objects with mixed types', () => {
    const obj = {
      str: 'text',
      num: 123,
      bool: true,
      arr: [1, 'two', false],
      nested: { x: 10 },
      nil: null,
    }
    const clone = cloneFnJSON(obj)
    expect(clone).toEqual(obj)
    expect(clone).not.toBe(obj)
    expect(clone.arr).not.toBe(obj.arr)
    expect(clone.nested).not.toBe(obj.nested)
  })

  it('should handle empty objects', () => {
    const clone = cloneFnJSON({})
    expect(clone).toEqual({})
  })

  it('should handle empty arrays', () => {
    const clone = cloneFnJSON([])
    expect(clone).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// useToNumber
// ---------------------------------------------------------------------------
describe('useToNumber', () => {
  it('should convert a string ref to a number using parseFloat by default', () => {
    const source = ref('3.14')
    const result = useToNumber(source)
    expect(result.value).toBe(3.14)
  })

  it('should handle integer strings with parseFloat', () => {
    const source = ref('42')
    const result = useToNumber(source)
    expect(result.value).toBe(42)
  })

  it('should use parseInt when specified', () => {
    const source = ref('3.99')
    const result = useToNumber(source, { method: 'parseInt' })
    expect(result.value).toBe(3)
  })

  it('should use parseInt with custom radix', () => {
    const source = ref('ff')
    const result = useToNumber(source, { method: 'parseInt', radix: 16 })
    expect(result.value).toBe(255)
  })

  it('should return NaN for non-numeric strings by default', () => {
    const source = ref('abc')
    const result = useToNumber(source)
    expect(Number.isNaN(result.value)).toBe(true)
  })

  it('should return 0 for non-numeric strings when nanToZero is true', () => {
    const source = ref('abc')
    const result = useToNumber(source, { nanToZero: true })
    expect(result.value).toBe(0)
  })

  it('should pass through numeric values unchanged', () => {
    const source = ref(42 as string | number)
    const result = useToNumber(source)
    expect(result.value).toBe(42)
  })

  it('should handle empty string', () => {
    const source = ref('')
    const result = useToNumber(source)
    expect(Number.isNaN(result.value)).toBe(true)
  })

  it('should handle empty string with nanToZero', () => {
    const source = ref('')
    const result = useToNumber(source, { nanToZero: true })
    expect(result.value).toBe(0)
  })

  it('should handle strings with leading whitespace', () => {
    const source = ref('  42  ')
    const result = useToNumber(source)
    expect(result.value).toBe(42)
  })

  it('should handle negative number strings', () => {
    const source = ref('-17.5')
    const result = useToNumber(source)
    expect(result.value).toBe(-17.5)
  })
})

// ---------------------------------------------------------------------------
// useToString
// ---------------------------------------------------------------------------
describe('useToString', () => {
  it('should convert a number ref to string', () => {
    const source = ref(42)
    const result = useToString(source)
    expect(result.value).toBe('42')
  })

  it('should convert zero to string', () => {
    const source = ref(0)
    const result = useToString(source)
    expect(result.value).toBe('0')
  })

  it('should convert boolean true to string', () => {
    const source = ref(true)
    const result = useToString(source)
    expect(result.value).toBe('true')
  })

  it('should convert boolean false to string', () => {
    const source = ref(false)
    const result = useToString(source)
    expect(result.value).toBe('false')
  })

  it('should convert null to empty string', () => {
    const source = ref(null)
    const result = useToString(source)
    expect(result.value).toBe('')
  })

  it('should convert undefined to empty string', () => {
    const source = ref(undefined)
    const result = useToString(source)
    expect(result.value).toBe('')
  })

  it('should convert an object to its string representation', () => {
    const source = ref({ a: 1 })
    const result = useToString(source)
    expect(result.value).toBe('[object Object]')
  })

  it('should handle string values passed through', () => {
    const source = ref('already a string')
    const result = useToString(source)
    expect(result.value).toBe('already a string')
  })

  it('should convert an array to string', () => {
    const source = ref([1, 2, 3])
    const result = useToString(source)
    expect(result.value).toBe('1,2,3')
  })
})

// ---------------------------------------------------------------------------
// useSupported
// ---------------------------------------------------------------------------
describe('useSupported', () => {
  it('should return true when callback returns true', () => {
    const isSupported = useSupported(() => true)
    expect(isSupported.value).toBe(true)
  })

  it('should return false when callback returns false', () => {
    const isSupported = useSupported(() => false)
    expect(isSupported.value).toBe(false)
  })

  it('should return false when callback throws an error', () => {
    const isSupported = useSupported(() => {
      throw new Error('not supported')
    })
    expect(isSupported.value).toBe(false)
  })

  it('should return false when callback throws a non-Error', () => {
    const isSupported = useSupported(() => {
      throw 'string error'
    })
    expect(isSupported.value).toBe(false)
  })

  it('should evaluate the callback immediately', () => {
    let evaluated = false
    useSupported(() => {
      evaluated = true
      return true
    })
    expect(evaluated).toBe(true)
  })

  it('should return a ref', () => {
    const isSupported = useSupported(() => true)
    expect(typeof isSupported.value).toBe('boolean')
    expect('subscribe' in isSupported).toBe(true)
  })

  it('should check complex conditions', () => {
    const isSupported = useSupported(() => {
      return typeof globalThis !== 'undefined' && typeof Array.isArray === 'function'
    })
    expect(isSupported.value).toBe(true)
  })

  it('should handle callback returning truthy non-boolean values', () => {
    // The callback should return a boolean, but if it returns something truthy...
    const isSupported = useSupported(() => true)
    expect(isSupported.value).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// createEventHook
// ---------------------------------------------------------------------------
describe('createEventHook', () => {
  it('should trigger registered listeners', () => {
    const hook = createEventHook<string>()
    const results: string[] = []
    hook.on((val) => results.push(val))
    hook.trigger('hello')
    expect(results).toEqual(['hello'])
  })

  it('should support multiple listeners', () => {
    const hook = createEventHook<number>()
    const results: number[] = []
    hook.on((val) => results.push(val * 1))
    hook.on((val) => results.push(val * 2))
    hook.trigger(5)
    expect(results).toEqual([5, 10])
  })

  it('should remove a listener using the returned off function', () => {
    const hook = createEventHook<string>()
    const results: string[] = []
    const { off } = hook.on((val) => results.push(val))
    hook.trigger('first')
    off()
    hook.trigger('second')
    expect(results).toEqual(['first'])
  })

  it('should remove a listener using the off method', () => {
    const hook = createEventHook<string>()
    const results: string[] = []
    const listener = (val: string) => results.push(val)
    hook.on(listener)
    hook.trigger('first')
    hook.off(listener)
    hook.trigger('second')
    expect(results).toEqual(['first'])
  })

  it('should handle triggering with no listeners', () => {
    const hook = createEventHook<string>()
    expect(() => hook.trigger('hello')).not.toThrow()
  })

  it('should not trigger a listener after it has been removed', () => {
    const hook = createEventHook<number>()
    const fn = mock(() => {})
    hook.on(fn)
    hook.trigger(1)
    hook.off(fn)
    hook.trigger(2)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should handle adding the same listener twice', () => {
    const hook = createEventHook<string>()
    const results: string[] = []
    const listener = (val: string) => results.push(val)
    hook.on(listener)
    hook.on(listener) // Set-based, so added only once
    hook.trigger('test')
    // Since it uses a Set, the listener is only added once
    expect(results).toEqual(['test'])
  })

  it('should pass the correct parameter to listeners', () => {
    const hook = createEventHook<{ name: string; age: number }>()
    let received: { name: string; age: number } | null = null
    hook.on((val) => { received = val })
    hook.trigger({ name: 'Alice', age: 30 })
    expect(received).toEqual({ name: 'Alice', age: 30 })
  })
})

// ---------------------------------------------------------------------------
// createGlobalState
// ---------------------------------------------------------------------------
describe('createGlobalState', () => {
  it('should create state on first call', () => {
    const useGlobal = createGlobalState(() => ({ count: ref(0) }))
    const state = useGlobal()
    expect(state.count.value).toBe(0)
  })

  it('should return the same state on subsequent calls', () => {
    const useGlobal = createGlobalState(() => ({ count: ref(0) }))
    const state1 = useGlobal()
    const state2 = useGlobal()
    expect(state1).toBe(state2)
  })

  it('should share state mutations across consumers', () => {
    const useGlobal = createGlobalState(() => ({ count: ref(0) }))
    const state1 = useGlobal()
    const state2 = useGlobal()
    state1.count.value = 42
    expect(state2.count.value).toBe(42)
  })

  it('should only invoke the factory once', () => {
    const factory = mock(() => ({ value: ref('initialized') }))
    const useGlobal = createGlobalState(factory)
    useGlobal()
    useGlobal()
    useGlobal()
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('should work with complex state shapes', () => {
    const useGlobal = createGlobalState(() => ({
      users: ref<string[]>([]),
      count: ref(0),
      active: ref(true),
    }))
    const state = useGlobal()
    state.users.value = ['alice', 'bob']
    state.count.value = 2
    const state2 = useGlobal()
    expect(state2.users.value).toEqual(['alice', 'bob'])
    expect(state2.count.value).toBe(2)
  })

  it('should work with primitive return values', () => {
    const useGlobal = createGlobalState(() => ref(100))
    const state1 = useGlobal()
    const state2 = useGlobal()
    expect(state1).toBe(state2)
    expect(state1.value).toBe(100)
  })

  it('should support independent global states', () => {
    const useGlobalA = createGlobalState(() => ref('A'))
    const useGlobalB = createGlobalState(() => ref('B'))
    const a = useGlobalA()
    const b = useGlobalB()
    expect(a.value).toBe('A')
    expect(b.value).toBe('B')
    a.value = 'modified A'
    expect(b.value).toBe('B')
  })

  it('should handle factory functions that return non-ref values', () => {
    const useGlobal = createGlobalState(() => ({ name: 'static', items: [1, 2, 3] }))
    const state = useGlobal()
    expect(state.name).toBe('static')
    expect(state.items).toEqual([1, 2, 3])
  })
})

// ---------------------------------------------------------------------------
// createSharedComposable
// ---------------------------------------------------------------------------
describe('createSharedComposable', () => {
  it('should return the same instance for multiple calls', () => {
    const useShared = createSharedComposable(() => ({ count: ref(0) }))
    const a = useShared()
    const b = useShared()
    expect(a).toBe(b)
  })

  it('should only invoke the composable once', () => {
    const composable = mock(() => ({ value: ref('shared') }))
    const useShared = createSharedComposable(composable)
    useShared()
    useShared()
    useShared()
    expect(composable).toHaveBeenCalledTimes(1)
  })

  it('should share state mutations between consumers', () => {
    const useShared = createSharedComposable(() => ({ count: ref(0) }))
    const a = useShared()
    const b = useShared()
    a.count.value = 99
    expect(b.count.value).toBe(99)
  })

  it('should track subscriber count', () => {
    let callCount = 0
    const composable = () => {
      callCount++
      return { data: ref(callCount) }
    }
    const useShared = createSharedComposable(composable)
    useShared()
    useShared()
    useShared()
    // Composable is only called once
    expect(callCount).toBe(1)
  })

  it('should pass arguments only on first invocation', () => {
    const composable = (initial: number) => ({ count: ref(initial) })
    const useShared = createSharedComposable(composable)
    const a = useShared(10)
    const b = useShared(20) // second arg is ignored since state already exists
    expect(a.count.value).toBe(10)
    expect(b.count.value).toBe(10)
  })

  it('should work with composables that return functions', () => {
    const useShared = createSharedComposable(() => {
      let count = 0
      return {
        increment: () => ++count,
        getCount: () => count,
      }
    })
    const a = useShared()
    const b = useShared()
    a.increment()
    a.increment()
    expect(b.getCount()).toBe(2)
  })

  it('should work with composables that return simple values', () => {
    const useShared = createSharedComposable(() => 'static value')
    const a = useShared()
    const b = useShared()
    expect(a).toBe('static value')
    expect(b).toBe('static value')
  })

  it('should handle composables with no arguments', () => {
    const useShared = createSharedComposable(() => ref(42))
    const a = useShared()
    const b = useShared()
    expect(a).toBe(b)
    expect(a.value).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// makeDestructurable
// ---------------------------------------------------------------------------
describe('makeDestructurable', () => {
  it('should support object destructuring', () => {
    const result = makeDestructurable(
      { x: 1, y: 2 } as const,
      [1, 2] as const,
    )
    const { x, y } = result
    expect(x).toBe(1)
    expect(y).toBe(2)
  })

  it('should support array destructuring', () => {
    const result = makeDestructurable(
      { x: 1, y: 2 } as const,
      [1, 2] as const,
    )
    const [a, b] = result
    expect(a).toBe(1)
    expect(b).toBe(2)
  })

  it('should support both destructuring styles simultaneously', () => {
    const result = makeDestructurable(
      { name: 'alice', age: 30 } as const,
      ['alice', 30] as const,
    )
    const { name, age } = result
    const [n, a] = result
    expect(name).toBe('alice')
    expect(age).toBe(30)
    expect(n).toBe('alice')
    expect(a).toBe(30)
  })

  it('should work with string values', () => {
    const result = makeDestructurable(
      { first: 'hello', second: 'world' },
      ['hello', 'world'] as const,
    )
    expect(result.first).toBe('hello')
    expect(result.second).toBe('world')
    const [a, b] = result
    expect(a).toBe('hello')
    expect(b).toBe('world')
  })

  it('should handle a single property', () => {
    const result = makeDestructurable(
      { value: 42 },
      [42] as const,
    )
    expect(result.value).toBe(42)
    const [v] = result
    expect(v).toBe(42)
  })

  it('should handle three or more properties', () => {
    const result = makeDestructurable(
      { a: 1, b: 2, c: 3 },
      [1, 2, 3] as const,
    )
    const { a, b, c } = result
    expect(a).toBe(1)
    expect(b).toBe(2)
    expect(c).toBe(3)
    const [x, y, z] = result
    expect(x).toBe(1)
    expect(y).toBe(2)
    expect(z).toBe(3)
  })

  it('should be iterable with spread', () => {
    const result = makeDestructurable(
      { x: 10, y: 20 },
      [10, 20] as const,
    )
    const spread = [...result]
    expect(spread).toEqual([10, 20])
  })

  it('should allow property access on the result', () => {
    const result = makeDestructurable(
      { foo: 'bar', baz: 'qux' },
      ['bar', 'qux'] as const,
    )
    expect(result.foo).toBe('bar')
    expect(result.baz).toBe('qux')
  })
})

// ---------------------------------------------------------------------------
// until
// ---------------------------------------------------------------------------
describe('until', () => {
  it('should resolve immediately if condition is already met with toBe', async () => {
    const r = ref(42)
    const result = await until(r).toBe(42)
    expect(result).toBe(42)
  })

  it('should resolve immediately if toBeTruthy condition is already met', async () => {
    const r = ref('truthy')
    const result = await until(r).toBeTruthy()
    expect(result).toBe('truthy')
  })

  it('should resolve on timeout without throwing by default', async () => {
    const r = ref(0)
    const result = await until(r).toBe(999, { timeout: 30 })
    expect(result).toBe(0) // resolves with current value
  })

  it('should reject on timeout when throwOnTimeout is true', async () => {
    const r = ref(0)
    try {
      await until(r).toBe(999, { timeout: 30, throwOnTimeout: true })
      expect(true).toBe(false) // Should not reach here
    }
    catch (e: any) {
      expect(e.message).toBe('Timeout')
    }
  })

  it('should resolve immediately when not.toBe condition is already met', async () => {
    const r = ref(10)
    const result = await until(r).not.toBe(5)
    expect(result).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// syncRef / syncRefs
// ---------------------------------------------------------------------------
describe('syncRef', () => {
  it('should stop all watchers when stop is called', () => {
    const left = ref(0)
    const right = ref(0)
    const stop = syncRef(left, right)
    stop()
    left.value = 1
    expect(right.value).toBe(0)
    right.value = 2
    expect(left.value).toBe(1)
  })
})

describe('syncRefs', () => {
  it('should handle empty sources array', () => {
    const target = ref(0)
    const stop = syncRefs([], target)
    expect(target.value).toBe(0)
    stop() // should not throw
  })

})

// ---------------------------------------------------------------------------
// useMemoize
// ---------------------------------------------------------------------------
describe('useMemoize', () => {
  it('should cache results based on arguments', () => {
    let callCount = 0
    const fn = useMemoize((a: number, b: number) => {
      callCount++
      return a + b
    })
    expect(fn(1, 2)).toBe(3)
    expect(fn(1, 2)).toBe(3)
    expect(callCount).toBe(1)
  })

  it('should call the function again for different arguments', () => {
    let callCount = 0
    const fn = useMemoize((a: number) => {
      callCount++
      return a * 2
    })
    fn(1)
    fn(2)
    fn(1)
    expect(callCount).toBe(2)
  })

  it('should support custom key function', () => {
    let callCount = 0
    const fn = useMemoize(
      (obj: { id: number; name: string }) => {
        callCount++
        return obj.name.toUpperCase()
      },
      (obj) => String(obj.id),
    )
    expect(fn({ id: 1, name: 'alice' })).toBe('ALICE')
    expect(fn({ id: 1, name: 'bob' })).toBe('ALICE') // same key, cached result
    expect(callCount).toBe(1)
  })

  it('should refresh cache with load', () => {
    let callCount = 0
    const fn = useMemoize((x: number) => {
      callCount++
      return x * callCount
    })
    expect(fn(5)).toBe(5) // 5 * 1
    expect(fn(5)).toBe(5) // cached
    const reloaded = fn.load(5) // forces re-evaluation
    expect(reloaded).toBe(10) // 5 * 2
    expect(fn(5)).toBe(10) // now cached with new value
  })

  it('should delete a cached entry', () => {
    let callCount = 0
    const fn = useMemoize((x: number) => {
      callCount++
      return x
    })
    fn(10)
    expect(callCount).toBe(1)
    fn(10)
    expect(callCount).toBe(1) // cached
    fn.delete(10)
    fn(10)
    expect(callCount).toBe(2) // re-evaluated
  })

  it('should clear all cached entries', () => {
    let callCount = 0
    const fn = useMemoize((x: number) => {
      callCount++
      return x
    })
    fn(1)
    fn(2)
    fn(3)
    expect(callCount).toBe(3)
    fn(1)
    fn(2)
    fn(3)
    expect(callCount).toBe(3) // all cached
    fn.clear()
    fn(1)
    fn(2)
    fn(3)
    expect(callCount).toBe(6) // all re-evaluated
  })

  it('should expose the cache map', () => {
    const fn = useMemoize((x: number) => x * 2)
    fn(5)
    fn(10)
    expect(fn.cache.size).toBe(2)
    expect(fn.cache.get(JSON.stringify([5]))).toBe(10)
    expect(fn.cache.get(JSON.stringify([10]))).toBe(20)
  })

  it('should handle no-argument functions', () => {
    let callCount = 0
    const fn = useMemoize(() => {
      callCount++
      return 'result'
    })
    expect(fn()).toBe('result')
    expect(fn()).toBe('result')
    expect(callCount).toBe(1)
  })

  it('should handle string arguments', () => {
    const fn = useMemoize((s: string) => s.toUpperCase())
    expect(fn('hello')).toBe('HELLO')
    expect(fn('world')).toBe('WORLD')
    expect(fn('hello')).toBe('HELLO')
    expect(fn.cache.size).toBe(2)
  })

  it('should differentiate between similar but different arguments', () => {
    let callCount = 0
    const fn = useMemoize((a: number, b: number) => {
      callCount++
      return a - b
    })
    fn(10, 5) // 5
    fn(5, 10) // -5
    expect(callCount).toBe(2)
    expect(fn(10, 5)).toBe(5)
    expect(fn(5, 10)).toBe(-5)
  })
})

// ---------------------------------------------------------------------------
// useConfirmDialog
// ---------------------------------------------------------------------------
describe('useConfirmDialog', () => {
  it('should start with isRevealed as false', () => {
    const { isRevealed } = useConfirmDialog()
    expect(isRevealed.value).toBe(false)
  })

  it('should set isRevealed to true when revealed', () => {
    const { isRevealed, reveal } = useConfirmDialog()
    reveal()
    expect(isRevealed.value).toBe(true)
  })

  it('should set isRevealed to false when confirmed', () => {
    const { isRevealed, reveal, confirm } = useConfirmDialog()
    reveal()
    expect(isRevealed.value).toBe(true)
    confirm()
    expect(isRevealed.value).toBe(false)
  })

  it('should set isRevealed to false when canceled', () => {
    const { isRevealed, reveal, cancel } = useConfirmDialog()
    reveal()
    expect(isRevealed.value).toBe(true)
    cancel()
    expect(isRevealed.value).toBe(false)
  })

  it('should resolve the reveal promise with isCanceled false on confirm', async () => {
    const { reveal, confirm } = useConfirmDialog()
    const promise = reveal()
    confirm()
    const result = await promise
    expect(result.isCanceled).toBe(false)
  })

  it('should resolve the reveal promise with isCanceled true on cancel', async () => {
    const { reveal, cancel } = useConfirmDialog()
    const promise = reveal()
    cancel()
    const result = await promise
    expect(result.isCanceled).toBe(true)
  })

  it('should pass data through confirm', async () => {
    const { reveal, confirm } = useConfirmDialog<string, string>()
    const promise = reveal()
    confirm('confirmed data')
    const result = await promise
    expect(result.data).toBe('confirmed data')
    expect(result.isCanceled).toBe(false)
  })

  it('should call onConfirm hook when confirmed', () => {
    const { reveal, confirm, onConfirm } = useConfirmDialog<void, string>()
    const received: (string | undefined)[] = []
    onConfirm((data) => { received.push(data) })
    reveal()
    confirm('yes')
    expect(received).toEqual(['yes'])
  })

  it('should call onCancel hook when canceled', () => {
    const { reveal, cancel, onCancel } = useConfirmDialog()
    let cancelCalled = false
    onCancel(() => { cancelCalled = true })
    reveal()
    cancel()
    expect(cancelCalled).toBe(true)
  })

  it('should call onReveal hook when revealed', () => {
    const { reveal, onReveal } = useConfirmDialog<string>()
    const received: (string | undefined)[] = []
    onReveal((data) => { received.push(data) })
    reveal('show me')
    expect(received).toEqual(['show me'])
  })

  it('should allow unsubscribing from hooks via off', () => {
    const { reveal, confirm, onConfirm } = useConfirmDialog<void, string>()
    const received: (string | undefined)[] = []
    const { off } = onConfirm((data) => { received.push(data) })
    reveal()
    confirm('first')
    off()
    reveal()
    confirm('second')
    expect(received).toEqual(['first'])
  })

  it('should handle multiple reveal/confirm cycles', async () => {
    const { reveal, confirm } = useConfirmDialog<void, number>()
    const promise1 = reveal()
    confirm(1)
    const result1 = await promise1
    expect(result1).toEqual({ data: 1, isCanceled: false })

    const promise2 = reveal()
    confirm(2)
    const result2 = await promise2
    expect(result2).toEqual({ data: 2, isCanceled: false })
  })

  it('should handle mixed confirm and cancel cycles', async () => {
    const { reveal, confirm, cancel } = useConfirmDialog<void, string>()
    const p1 = reveal()
    confirm('ok')
    const r1 = await p1
    expect(r1.isCanceled).toBe(false)

    const p2 = reveal()
    cancel()
    const r2 = await p2
    expect(r2.isCanceled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// useEventBus
// ---------------------------------------------------------------------------
describe('useEventBus', () => {
  it('should emit and receive events', () => {
    const bus = useEventBus<string>('test-emit-' + Math.random())
    const received: string[] = []
    bus.on((e) => received.push(e))
    bus.emit('hello')
    expect(received).toEqual(['hello'])
  })

  it('should support multiple listeners', () => {
    const bus = useEventBus<number>('test-multi-' + Math.random())
    const results: number[] = []
    bus.on((e) => results.push(e * 1))
    bus.on((e) => results.push(e * 2))
    bus.emit(5)
    expect(results).toEqual([5, 10])
  })

  it('should remove a listener with off', () => {
    const bus = useEventBus<string>('test-off-' + Math.random())
    const results: string[] = []
    const listener = (e: string) => results.push(e)
    bus.on(listener)
    bus.emit('first')
    bus.off(listener)
    bus.emit('second')
    expect(results).toEqual(['first'])
  })

  it('should remove a listener with the returned unsubscribe function', () => {
    const bus = useEventBus<string>('test-unsub-' + Math.random())
    const results: string[] = []
    const unsub = bus.on((e) => results.push(e))
    bus.emit('first')
    unsub()
    bus.emit('second')
    expect(results).toEqual(['first'])
  })

  it('should support once listeners', () => {
    const bus = useEventBus<number>('test-once-' + Math.random())
    const results: number[] = []
    bus.once((e) => results.push(e))
    bus.emit(1)
    bus.emit(2)
    bus.emit(3)
    expect(results).toEqual([1])
  })

  it('should allow unsubscribing a once listener before it fires', () => {
    const bus = useEventBus<string>('test-once-unsub-' + Math.random())
    const results: string[] = []
    const unsub = bus.once((e) => results.push(e))
    unsub()
    bus.emit('should not appear')
    expect(results).toEqual([])
  })

  it('should reset all listeners', () => {
    const bus = useEventBus<string>('test-reset-' + Math.random())
    const results: string[] = []
    bus.on((e) => results.push(e))
    bus.on((e) => results.push(e + '!'))
    bus.emit('before')
    expect(results).toEqual(['before', 'before!'])
    bus.reset()
    bus.emit('after')
    expect(results).toEqual(['before', 'before!']) // no new entries
  })

  it('should share the same bus for the same key', () => {
    const key = 'shared-key-' + Math.random()
    const bus1 = useEventBus<string>(key)
    const bus2 = useEventBus<string>(key)
    const results: string[] = []
    bus1.on((e) => results.push('bus1:' + e))
    bus2.on((e) => results.push('bus2:' + e))
    bus1.emit('test')
    expect(results).toContain('bus1:test')
    expect(results).toContain('bus2:test')
  })

  it('should not share buses with different keys', () => {
    const bus1 = useEventBus<string>('key-a-' + Math.random())
    const bus2 = useEventBus<string>('key-b-' + Math.random())
    const results1: string[] = []
    const results2: string[] = []
    bus1.on((e) => results1.push(e))
    bus2.on((e) => results2.push(e))
    bus1.emit('only-for-a')
    expect(results1).toEqual(['only-for-a'])
    expect(results2).toEqual([])
  })

  it('should handle symbol keys', () => {
    const key = Symbol('test-bus')
    const bus = useEventBus<number>(key)
    const results: number[] = []
    bus.on((e) => results.push(e))
    bus.emit(42)
    expect(results).toEqual([42])
  })

  it('should handle emitting with no listeners', () => {
    const bus = useEventBus<string>('empty-bus-' + Math.random())
    expect(() => bus.emit('hello')).not.toThrow()
  })

  it('should handle off for a listener that was not registered', () => {
    const bus = useEventBus<string>('off-unregistered-' + Math.random())
    const listener = () => {}
    expect(() => bus.off(listener)).not.toThrow()
  })

  it('should handle multiple once listeners', () => {
    const bus = useEventBus<number>('multi-once-' + Math.random())
    const results: number[] = []
    bus.once((e) => results.push(e))
    bus.once((e) => results.push(e * 10))
    bus.emit(3)
    bus.emit(4)
    expect(results).toEqual([3, 30])
  })
})
