---
name: stacks-arrays
description: Use when working with array utilities in Stacks — statistical operations (average, median, mode, standard deviation, z-score, percentile, covariance), array manipulation (unique, flatten, partition, shuffle, sample, move), containment checks, or the Arr facade. Covers @stacksjs/arrays.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Array Utilities

## Key Paths
- Core package: `storage/framework/core/arrays/src/`
- Package: `@stacksjs/arrays`

## Architecture

The `index.ts` exports:
```typescript
export * from './arr'
export * as arr from './arr'
export * from './macro'
```

The `arr.ts` re-exports from three submodules:
- `contains.ts` — containment check functions
- `helpers.ts` — array manipulation (toArray, flatten, partition, unique, shuffle, etc.)
- `math.ts` — statistical functions (average, median, mode, variance, etc.)

The `macro.ts` provides the `Arr` and `arr` facade objects.

## Array Manipulation (`helpers.ts`)

### Converting to Arrays
```typescript
import type { Arrayable, Nullable } from '@stacksjs/types'

toArray('foo')           // ['foo']
toArray(['foo'])         // ['foo']
toArray(null)            // []
toArray(undefined)       // []
toArray(1)               // [1]
toArray({ a: 1 })        // [{ a: 1 }]
```

### Flattening
```typescript
flatten([1, [2, [3, [4, [5]]]]])   // [1, 2, 3, 4, 5]  -- fully recursive
flatten(null)                       // []
flatten('hello')                    // ['hello']
```

### Merging
```typescript
mergeArrayable([1, 2], [3, 4], [5, 6])   // [1, 2, 3, 4, 5, 6]
mergeArrayable(1, [2, 3], null)           // [1, 2, 3]  -- handles non-arrays and nulls
```

### Unique Values
```typescript
uniq([1, 1, 2, 3])                        // [1, 2, 3]  -- uses Set
unique([1, 1, 2, 3])                      // [1, 2, 3]  -- alias for uniq

uniqueBy(
  [{ id: 1 }, { id: 1 }, { id: 2 }],
  (a, b) => a.id === b.id
)                                          // [{ id: 1 }, { id: 2 }]
```

### Accessing Elements
```typescript
last([1, 2, 3])                    // 3
last([])                            // undefined

at([1, 2, 3], 0)                   // 1
at([1, 2, 3], -1)                  // 3   -- negative indexing
at([1, 2, 3], 3)                   // undefined -- out of bounds
at([], 0)                           // undefined
```

### Mutation
```typescript
const arr = [1, 2, 3]
remove(arr, 2)                     // true -- arr is now [1, 3]
remove(arr, 4)                     // false -- value not found, arr unchanged
// WARNING: remove() MUTATES the original array
```

### Reordering
```typescript
move([1, 2, 3, 4], 0, 2)          // [2, 3, 1, 4]
move([1, 2, 3, 4], 0, -1)         // [2, 3, 4, 1]  -- negative indexing
move([1, 2, 3, 4], -1, 0)         // [4, 1, 2, 3]
// WARNING: move() MUTATES the original array (splices in place)
```

### Random Selection
```typescript
sample([1, 2, 3, 4, 5], 3)        // e.g. [3, 1, 5] -- 3 random items
// Items can repeat -- uses Math.random() * arr.length per pick
```

### Shuffling
```typescript
shuffle([1, 2, 3, 4])             // e.g. [3, 1, 4, 2]
// WARNING: shuffle() MUTATES the original array (Fisher-Yates in-place)
```

### Clamping
```typescript
clampArrayRange([1, 2, 3], 0)     // 0
clampArrayRange([1, 2, 3], 5)     // 2   -- clamped to last valid index
clampArrayRange([1, 2, 3], -1)    // 0   -- clamped to 0
// Uses clamp() from @stacksjs/browser
```

### Partitioning
```typescript
// With 1 filter: returns [matches, rest]
const [odds, evens] = partition([1, 2, 3, 4], i => i % 2 !== 0)
// odds = [1, 3], evens = [2, 4]

// With 2 filters: returns [f1 matches, f2 matches, rest]
const [small, medium, large] = partition(
  [1, 5, 10, 50, 100],
  n => n < 10,
  n => n < 50
)
// small = [1, 5], medium = [10], large = [50, 100]

// Supports up to 6 filter functions, always returns one extra array for unmatched items
```

Partition filter signature: `(item: T, index: number, array: readonly T[]) => any`

## Containment Checks (`contains.ts`)

All containment functions work with `string[]`. The `contains` function checks if the needle includes any element from the haystack (substring matching via `needle.includes(hay)`).

```typescript
contains('foobar', ['foo', 'baz'])              // true  -- 'foobar'.includes('foo')
contains('hello', ['foo', 'bar'])               // false

containsAll(['foo', 'bar'], ['foobar', 'barx']) // true  -- all needles found
containsAll(['foo', 'qux'], ['foobar'])         // false -- 'qux' not found

containsAny(['foo', 'qux'], ['foobar'])         // true  -- at least one found
containsAny(['baz', 'qux'], ['foobar'])         // false

containsNone(['baz', 'qux'], ['foobar'])        // true  -- none found
containsNone(['foo', 'qux'], ['foobar'])        // false

containsOnly(['foo', 'bar'], ['foobar', 'barx']) // checks if haystack items only contain needles
// Implemented as: containsAll(haystack, needles) -- reversed args

doesNotContain('qux', ['foo', 'bar'])           // true
doesNotContain('foo', ['foobar'])               // false
```

**Important**: `contains` uses `needle.includes(hay)`, NOT `haystack.includes(needle)`. It checks if the needle string contains any of the haystack substrings. This is substring matching, not array membership.

## Statistical Functions (`math.ts`)

All statistical functions expect `number[]` and throw `Error` on empty arrays (except `sum` and `product` which return identity values).

### Basic Aggregates
```typescript
sum([1, 2, 3, 4])                  // 10  -- reduce with +
product([2, 3, 4])                 // 24  -- reduce with *
min([5, 1, 3])                     // 1   -- Math.min(), throws on empty
max([5, 1, 3])                     // 5   -- Math.max(), throws on empty
range([1, 5, 3])                   // 4   -- max - min
```

### Central Tendency
```typescript
average([1, 2, 3, 4, 5])          // 3      -- sum / length
avg([1, 2, 3])                     // 2      -- alias for average

median([1, 2, 3, 4, 5])           // 3      -- middle value (sorted)
median([1, 2, 3, 4])              // 2.5    -- average of two middle values

mode([1, 2, 2, 3, 3, 4, 4, 4])   // 4      -- most frequent value
mode([1, 2, 3, 4])                // 1      -- first value when all equal frequency
```

### Dispersion
```typescript
variance([1, 2, 3, 4])            // 1.25   -- population variance (not sample)
standardDeviation([1, 2, 3, 4])   // 1.118... -- sqrt(variance), population std dev
```

### Advanced Statistics
```typescript
zScore([1, 2, 3, 4], 2)           // -0.447... -- (value - mean) / stddev
zScore([1, 2, 3, 4], 3)           // 0.447...

percentile([1, 2, 3, 4, 5], 50)   // 3       -- interpolated percentile
percentile([1, 2, 3, 4], 25)      // 1.75    -- linear interpolation
// Note: takes percentile value (0-100), uses linear interpolation

interquartileRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
// Q3 median - Q1 median
// Splits array at midpoint, computes median of each half

covariance([1, 2, 3, 4], [1, 2, 3, 4])     // 1.25  -- positive correlation
covariance([1, 2, 3, 4], [4, 3, 2, 1])     // -1.25 -- negative correlation
// Throws if arrays have different lengths
```

**Important**: `variance` and `standardDeviation` compute POPULATION metrics (divides by N), not sample metrics (which would divide by N-1).

## Arr Facade (`macro.ts`)

Both `Arr` and `arr` are exported as equivalent facade objects.

```typescript
import { Arr, arr } from '@stacksjs/arrays'

// Array manipulation
Arr.toArray(value)                 // convert to array
Arr.flatten(array)                 // recursive flatten
Arr.mergeArrayable(...arrays)      // merge arrays
Arr.unique(arr)                    // deduplicate (Set-based)
Arr.uniqueBy(arr, equalFn)        // deduplicate with custom equality
Arr.last(arr)                      // last element
Arr.at(arr, index)                 // get by index (negative supported)
Arr.remove(arr, value)             // remove first occurrence (mutates)
Arr.move(arr, from, to)            // move element (mutates)
Arr.clampArrayRange(arr, n)        // clamp index to bounds
Arr.shuffle(arr)                   // shuffle in place
Arr.sample(arr, count)             // random items
Arr.random(arr, count)             // alias for sample, filters nulls
Arr.partition(arr, filter)         // partition by filter

// Containment
Arr.contains(needle, haystack)
Arr.containsAll(needles, haystack)
Arr.containsAny(needles, haystack)
Arr.containsNone(needles, haystack)
Arr.containsOnly(needles, haystack)
Arr.doesNotContain(needle, haystack)

// Statistics
Arr.sum(arr)                       // sum
Arr.average(arr)                   // mean
Arr.avg(arr)                       // alias for average
Arr.median(arr)                    // median
Arr.mode(arr)                      // mode
Arr.range(arr)                     // max - min
```

Note: The `Arr` facade does NOT expose `variance`, `standardDeviation`, `zScore`, `percentile`, `interquartileRange`, `covariance`, `product`, `min`, or `max` -- use the standalone functions for those.

The facade adds one extra method not in the standalone functions:
```typescript
Arr.random(arr, count)   // like sample but filters null/undefined from results
```

## Exported Types

```typescript
type PartitionFilter<T> = (item: T, index: number, array: readonly T[]) => any
// Also uses Arrayable<T> and Nullable<T> from @stacksjs/types
```

## Gotchas
- `shuffle()` and `move()` MUTATE the original array -- they do NOT return copies
- `remove()` MUTATES the original array and returns a boolean (not the removed element)
- `sample()` can return duplicate items since each pick is independent
- `contains()` uses SUBSTRING matching (`needle.includes(hay)`), not array membership -- `contains('foobar', ['foo'])` is true
- Statistical functions throw on empty arrays (except `sum` which returns 0 and `product` which returns 1)
- `variance` and `standardDeviation` use POPULATION formulas (divide by N), not sample formulas
- `percentile` takes a value 0-100 and uses linear interpolation between sorted array elements
- `interquartileRange` splits the sorted array at the midpoint and takes median of each half
- `mode` returns the first most-frequent value when there's a tie
- For complex collection operations with chaining, consider `@stacksjs/collections`
- The `Arr` facade wraps most but not all standalone functions -- advanced stats need direct imports
