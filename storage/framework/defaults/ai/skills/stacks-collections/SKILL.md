---
name: stacks-collections
description: Use when working with collection data structures in Stacks - chaining array operations, Laravel-style collection methods, mapping, filtering, reducing, or grouping. Covers @stacksjs/collections which wraps ts-collect.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Collections

## Key Paths
- Core package: `storage/framework/core/collections/src/`
- Source: `storage/framework/core/collections/src/index.ts`
- Package: `@stacksjs/collections`

## API

The package re-exports `collect` from `ts-collect`:

```typescript
import { collect } from '@stacksjs/collections'
```

## Usage

```typescript
import { collect } from '@stacksjs/collections'

// Basic operations
const result = collect([1, 2, 3, 4, 5])
  .filter(n => n > 2)
  .map(n => n * 2)
  .toArray()
// [6, 8, 10]

// Aggregation
collect([10, 20, 30]).sum()     // 60
collect([10, 20, 30]).avg()     // 20
collect([10, 20, 30]).min()     // 10
collect([10, 20, 30]).max()     // 30

// Grouping
collect(users).groupBy('role')
// Map<role, CollectionOperations<User>>; use groups.get('admin')?.toArray()

// Sorting
collect(items).sortBy('price').toArray()
collect(items).sortByDesc('price').toArray()

// Unique
collect([1, 2, 2, 3, 3]).unique().toArray()  // [1, 2, 3]

// First / Last
collect([1, 2, 3]).first()     // 1
collect([1, 2, 3]).last()      // 3

// Chunk
collect([1, 2, 3, 4, 5]).chunk(2).toArray()
// [[1, 2], [3, 4], [5]]

// Pluck
collect(users).pluck('name').toArray()  // ['Alice', 'Bob']

// Contains
collect([1, 2, 3]).contains(2)  // true

// Reduce
collect([1, 2, 3]).reduce((sum, n) => sum + n, 0)  // 6
```

## Laravel-Style Methods

The API is inspired by Laravel, but the installed TypeScript implementation is
the authority. Its method names, argument order, return types and mutation
semantics are not an assertion of complete Laravel compatibility. Use the
exported `CollectionOperations<T>` type to check a method before using it.

Verified common operations include `map`, `filter`, `reduce`, `flatMap`,
`chunk`, `groupBy`, `keyBy`, `countBy`, `pluck`, `sortBy`, `sortByDesc`,
`unique`, `sum`, `avg`, `min`, `max`, `first`, `last`, `partition`,
`where`, `whereIn`, `intersect`, `union`, and `toArray`. The installed release
uses `toJSON`, not the assumed `toJson` spelling. `groupBy` returns a Map of
collections; `keyBy` and `countBy` also return Maps. Read their types when
serializing or passing them across a package boundary.

The wrapper exports `Collection`, `CollectionOperations`, `CollectionMetrics`,
`LazyCollectionOperations`, `PaginationResult`, `StandardDeviationResult` and
`ValidationSchema`. Annotate exported collection values with a named type to
keep declaration generation from degrading an inferred re-export to unknown.

## Gotchas
- **Thin wrapper** - re-exports `collect` and collection types from `ts-collect`
- **Mutation is method-specific** - map/filter return new collections, while
  pop/shift mutate the collection's shared backing array. Clone input if later
  operations must not change the caller's array.
- **For simple array operations** - `@stacksjs/arrays` may be more appropriate
- **Map results are not JSON objects** - convert them deliberately; JSON.stringify
  on a Map does not serialize its entries.
- **Not used for ORM results** - ORM queries return plain arrays, not collections. Wrap with `collect()` if needed
