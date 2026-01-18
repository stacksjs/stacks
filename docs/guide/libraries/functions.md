# Function Libraries

Build reusable TypeScript function libraries with Stacks.

## Overview

Function libraries provide reusable utilities, composables, and helpers that can be shared across projects.

## Project Structure

Organize functions by category:

```
functions/
├── string/
│   ├── capitalize.ts
│   ├── slugify.ts
│   └── index.ts
├── array/
│   ├── chunk.ts
│   ├── unique.ts
│   └── index.ts
├── composables/
│   ├── useDebounce.ts
│   ├── useThrottle.ts
│   └── index.ts
├── validators/
│   ├── isEmail.ts
│   ├── isUrl.ts
│   └── index.ts
└── index.ts
```

## Writing Functions

### Pure Functions

Write pure, predictable functions:

```typescript
// functions/string/capitalize.ts
/**
 * Capitalize the first letter of a string
 * @param str - The string to capitalize
 * @returns The capitalized string
 * @example
 * capitalize('hello') // 'Hello'
 * capitalize('HELLO') // 'HELLO'
 */
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Capitalize all words in a string
 * @param str - The string to title case
 * @returns The title cased string
 * @example
 * titleCase('hello world') // 'Hello World'
 */
export function titleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  )
}
```

### Generic Functions

Use TypeScript generics for flexibility:

```typescript
// functions/array/chunk.ts
/**
 * Split an array into chunks of a specified size
 * @param array - The array to split
 * @param size - The size of each chunk
 * @returns An array of chunks
 * @example
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be greater than 0')
  }

  const result: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

/**
 * Get unique values from an array
 * @param array - The array to deduplicate
 * @param key - Optional key function for object comparison
 * @returns Array with unique values
 */
export function unique<T>(array: T[], key?: (item: T) => unknown): T[] {
  if (!key) {
    return [...new Set(array)]
  }

  const seen = new Set()
  return array.filter(item => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
```

## Vue Composables

### Stateful Composables

Create composables with reactive state:

```typescript
// functions/composables/useCounter.ts
import { ref, computed, type Ref, type ComputedRef } from 'vue'

export interface UseCounterOptions {
  min?: number
  max?: number
}

export interface UseCounterReturn {
  count: Ref<number>
  doubled: ComputedRef<number>
  increment: () => void
  decrement: () => void
  set: (value: number) => void
  reset: () => void
}

export function useCounter(
  initial = 0,
  options: UseCounterOptions = {}
): UseCounterReturn {
  const { min = -Infinity, max = Infinity } = options
  const count = ref(initial)

  const doubled = computed(() => count.value * 2)

  function increment() {
    if (count.value < max) {
      count.value++
    }
  }

  function decrement() {
    if (count.value > min) {
      count.value--
    }
  }

  function set(value: number) {
    count.value = Math.max(min, Math.min(max, value))
  }

  function reset() {
    count.value = initial
  }

  return {
    count,
    doubled,
    increment,
    decrement,
    set,
    reset,
  }
}
```

### Side Effect Composables

Handle side effects cleanly:

```typescript
// functions/composables/useDebounce.ts
import { ref, watch, type Ref } from 'vue'

export function useDebounce<T>(
  value: Ref<T>,
  delay: number = 300
): Ref<T> {
  const debouncedValue = ref(value.value) as Ref<T>
  let timeout: Timer | null = null

  watch(value, (newValue) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      debouncedValue.value = newValue
    }, delay)
  })

  return debouncedValue
}

// functions/composables/useThrottle.ts
import { ref, watch, type Ref } from 'vue'

export function useThrottle<T>(
  value: Ref<T>,
  delay: number = 300
): Ref<T> {
  const throttledValue = ref(value.value) as Ref<T>
  let lastRun = 0

  watch(value, (newValue) => {
    const now = Date.now()
    if (now - lastRun >= delay) {
      throttledValue.value = newValue
      lastRun = now
    }
  })

  return throttledValue
}
```

### Async Composables

Handle async operations:

```typescript
// functions/composables/useFetch.ts
import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'

export interface UseFetchOptions<T> {
  immediate?: boolean
  initialData?: T
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

export interface UseFetchReturn<T> {
  data: ShallowRef<T | null>
  error: ShallowRef<Error | null>
  loading: Ref<boolean>
  execute: () => Promise<void>
}

export function useFetch<T>(
  url: string | Ref<string>,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const { immediate = true, initialData = null, onSuccess, onError } = options

  const data = shallowRef<T | null>(initialData)
  const error = shallowRef<Error | null>(null)
  const loading = ref(false)

  async function execute() {
    loading.value = true
    error.value = null

    try {
      const targetUrl = typeof url === 'string' ? url : url.value
      const response = await fetch(targetUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      data.value = result
      onSuccess?.(result)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      error.value = err
      onError?.(err)
    } finally {
      loading.value = false
    }
  }

  if (immediate) {
    execute()
  }

  return {
    data,
    error,
    loading,
    execute,
  }
}
```

## Validators

### Input Validation

Create reusable validators:

```typescript
// functions/validators/index.ts

export function isEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

export function isUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function isPhone(value: string, country: 'US' | 'UK' = 'US'): boolean {
  const patterns = {
    US: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
    UK: /^(\+44|0)7\d{9}$/,
  }
  return patterns[country].test(value)
}

export function isStrongPassword(value: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (value.length < 8) {
    errors.push('Must be at least 8 characters')
  }
  if (!/[A-Z]/.test(value)) {
    errors.push('Must contain uppercase letter')
  }
  if (!/[a-z]/.test(value)) {
    errors.push('Must contain lowercase letter')
  }
  if (!/[0-9]/.test(value)) {
    errors.push('Must contain number')
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    errors.push('Must contain special character')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

## Type Utilities

### Helper Types

Export useful type utilities:

```typescript
// functions/types.ts

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Make specific properties required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Extract function return type
 */
export type AsyncReturnType<T extends (...args: any[]) => Promise<any>> =
  T extends (...args: any[]) => Promise<infer R> ? R : never

/**
 * Create a type with only picked keys
 */
export type PickByValue<T, V> = Pick<
  T,
  { [K in keyof T]: T[K] extends V ? K : never }[keyof T]
>
```

## Exports

### Organize Exports

Structure your main export:

```typescript
// functions/index.ts

// String utilities
export {
  capitalize,
  titleCase,
  slugify,
  truncate,
} from './string'

// Array utilities
export {
  chunk,
  unique,
  shuffle,
  groupBy,
} from './array'

// Composables
export {
  useCounter,
  useDebounce,
  useThrottle,
  useFetch,
  useLocalStorage,
} from './composables'

// Validators
export {
  isEmail,
  isUrl,
  isPhone,
  isStrongPassword,
} from './validators'

// Types
export type {
  DeepPartial,
  RequireKeys,
  AsyncReturnType,
} from './types'
```

## Testing

### Unit Tests

Test functions thoroughly:

```typescript
// functions/string/capitalize.test.ts
import { describe, it, expect } from 'bun:test'
import { capitalize, titleCase } from './capitalize'

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('handles empty string', () => {
    expect(capitalize('')).toBe('')
  })

  it('handles already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })

  it('handles single character', () => {
    expect(capitalize('a')).toBe('A')
  })
})

describe('titleCase', () => {
  it('capitalizes all words', () => {
    expect(titleCase('hello world')).toBe('Hello World')
  })

  it('handles mixed case', () => {
    expect(titleCase('hELLO wORLD')).toBe('Hello World')
  })
})
```

### Testing Composables

```typescript
// functions/composables/useCounter.test.ts
import { describe, it, expect } from 'bun:test'
import { useCounter } from './useCounter'

describe('useCounter', () => {
  it('starts at initial value', () => {
    const { count } = useCounter(5)
    expect(count.value).toBe(5)
  })

  it('increments', () => {
    const { count, increment } = useCounter(0)
    increment()
    expect(count.value).toBe(1)
  })

  it('respects max', () => {
    const { count, increment } = useCounter(0, { max: 1 })
    increment()
    increment()
    expect(count.value).toBe(1)
  })

  it('computes doubled', () => {
    const { count, doubled } = useCounter(5)
    expect(doubled.value).toBe(10)
  })
})
```

## Documentation

### JSDoc Comments

Document all functions:

```typescript
/**
 * Slugify a string for URL-safe usage
 *
 * @param str - The string to slugify
 * @param options - Slugify options
 * @returns The slugified string
 *
 * @example
 * ```typescript
 * slugify('Hello World!') // 'hello-world'
 * slugify('Café Müller', { transliterate: true }) // 'cafe-muller'
 * ```
 */
export function slugify(
  str: string,
  options: SlugifyOptions = {}
): string {
  // implementation
}
```

## Best Practices

1. **Pure by default** - Minimize side effects
2. **Type everything** - Full TypeScript coverage
3. **Document thoroughly** - JSDoc for all exports
4. **Test comprehensively** - Cover edge cases
5. **Keep it small** - One function, one purpose
6. **Use generics** - Make functions flexible

## Related

- [Getting Started](/guide/libraries/get-started) - Library setup
- [Components](/guide/libraries/components) - Component libraries
- [Publishing](/guide/libraries/publish) - Publishing workflow
