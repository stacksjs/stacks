---
name: stacks-collections
description: Use when working with collection data structures in Stacks — chaining array operations, Laravel-style collection methods, mapping, filtering, reducing, or grouping. Covers @stacksjs/collections which wraps ts-collect.
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
// { admin: [...], user: [...] }

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

The `ts-collect` library provides a comprehensive Laravel Collection-compatible API including:

`all`, `avg`, `chunk`, `collapse`, `combine`, `concat`, `contains`, `count`, `countBy`, `crossJoin`, `dd`, `diff`, `diffAssoc`, `diffKeys`, `dump`, `duplicates`, `each`, `every`, `except`, `filter`, `first`, `firstOrFail`, `firstWhere`, `flatMap`, `flatten`, `flip`, `forget`, `forPage`, `get`, `groupBy`, `has`, `implode`, `intersect`, `intersectByKeys`, `isEmpty`, `isNotEmpty`, `join`, `keyBy`, `keys`, `last`, `macro`, `map`, `mapInto`, `mapSpread`, `mapToGroups`, `mapWithKeys`, `max`, `median`, `merge`, `mergeRecursive`, `min`, `mode`, `nth`, `only`, `pad`, `partition`, `pipe`, `pluck`, `pop`, `prepend`, `pull`, `push`, `put`, `random`, `reduce`, `reject`, `replace`, `replaceRecursive`, `reverse`, `search`, `shift`, `shuffle`, `skip`, `skipUntil`, `skipWhile`, `slice`, `sole`, `some`, `sort`, `sortBy`, `sortByDesc`, `sortDesc`, `sortKeys`, `sortKeysDesc`, `splice`, `split`, `sum`, `take`, `takeUntil`, `takeWhile`, `tap`, `times`, `toArray`, `toJson`, `transform`, `union`, `unique`, `uniqueStrict`, `unless`, `unlessEmpty`, `unlessNotEmpty`, `unwrap`, `values`, `when`, `whenEmpty`, `whenNotEmpty`, `where`, `whereBetween`, `whereIn`, `whereInstanceOf`, `whereNotBetween`, `whereNotIn`, `whereNotNull`, `whereNull`, `wrap`, `zip`

## Gotchas
- **Thin wrapper** — re-exports `collect` from `ts-collect`, no custom additions
- **Collections are immutable** — operations return new collection instances
- **For simple array operations** — `@stacksjs/arrays` may be more appropriate
- **Laravel API compatibility** — method names and behavior match Laravel's Collection class
- **Not used for ORM results** — ORM queries return plain arrays, not collections. Wrap with `collect()` if needed
