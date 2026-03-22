---
name: stacks-objects
description: Use when working with object manipulation in Stacks — deep merging with type safety, object mapping/transformation, strict key checking, typed entries/keys, property picking, clearing undefined values, or the DeepMerge utility type. Covers @stacksjs/objects.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Object Utilities

Type-safe object manipulation helpers. All functions are exported from a single file.

## Key Path
- Core package: `storage/framework/core/objects/src/index.ts` (single file, all functions)

## Dependencies
- `@stacksjs/types` -- `DeepMerge` type
- `@stacksjs/utils` -- `notNullish` filter function
- `@stacksjs/validation` -- `isObject` type guard

## Functions

### objectMap -- Transform Object Key/Value Pairs
```typescript
function objectMap<K extends string, V, NK = K, NV = V>(
  obj: Record<K, V>,
  fn: (key: K, value: V) => [NK, NV] | undefined,
): Record<K, V>
```

The callback receives `(key, value)` and must return either:
- `[newKey, newValue]` tuple to include the entry
- `undefined` to filter out the entry

Implementation uses `Object.fromEntries(Object.entries(obj).map(...).filter(notNullish))`.

```typescript
// Transform values
objectMap({ a: 1, b: 2 }, (k, v) => [k, v * 2])
// { a: 2, b: 4 }

// Rename keys
objectMap({ a: 1, b: 2 }, (k, v) => [`prefix_${k}`, v])
// { prefix_a: 1, prefix_b: 2 }

// Swap key/value
objectMap({ a: 1, b: 2 }, (k, v) => [v, k])
// { 1: 'a', 2: 'b' }

// Filter entries (return undefined to exclude)
objectMap({ a: 1, b: 2, c: 3 }, (k, v) => k === 'b' ? undefined : [k, v])
// { a: 1, c: 3 }
```

### deepMerge -- Deep Merge Objects
```typescript
function deepMerge<T extends object = object, S extends object = T>(
  target: T,
  ...sources: S[]
): DeepMerge<T, S>
```

Recursively merges source objects into target. Handles multiple sources via recursive spread.

Key behaviors:
- Only merges "mergeable objects" (objects that are not arrays, checked via `isObject()` and `!Array.isArray()`)
- Arrays are NOT deeply merged -- they are replaced entirely
- Missing keys in target are created as empty objects `{}` before recursive merge
- **Mutates the target object** -- the return value IS the modified target
- Processes sources left to right

```typescript
const target = { a: 1, nested: { x: 1, y: 2 } }
const source = { b: 2, nested: { y: 3, z: 4 } }
const result = deepMerge(target, source)
// result === target (same reference, mutated)
// { a: 1, b: 2, nested: { x: 1, y: 3, z: 4 } }

// Multiple sources
const merged = deepMerge(defaults, userConfig, overrides)
```

The `DeepMerge<T, S>` type (from `@stacksjs/types`) provides full type inference:
```typescript
type DeepMerge<F, S> = MergeInsertions<{
  [K in keyof F | keyof S]: K extends keyof S & keyof F
    ? DeepMerge<F[K], S[K]>
    : K extends keyof S ? S[K]
    : K extends keyof F ? F[K]
    : never
}>
```

### objectPick -- Pick Properties by Key
```typescript
function objectPick<O extends object, T extends keyof O>(
  obj: O,
  keys: T[],
  omitUndefined?: boolean,   // default: false
): Pick<O, T>
```

Creates a new object with only the specified keys. Uses `reduce` internally.

```typescript
const user = { id: 1, name: 'John', email: 'john@test.com', password: 'secret' }
objectPick(user, ['id', 'name', 'email'])
// { id: 1, name: 'John', email: 'john@test.com' }

// With omitUndefined=true, skips keys whose values are undefined
const partial = { id: 1, name: 'John', bio: undefined }
objectPick(partial, ['id', 'name', 'bio'], true)
// { id: 1, name: 'John' }  (bio omitted)
```

- Only includes keys that exist in the object (`k in obj` check)
- With `omitUndefined=true`, additionally skips keys where `obj[k] === undefined`

### clearUndefined -- Remove Undefined Fields
```typescript
function clearUndefined<T extends object>(obj: T): T
```

**Mutates the object** by deleting keys whose values are `undefined`. Returns the same object reference.

```typescript
const data = { name: 'John', age: undefined, email: 'john@test.com' }
clearUndefined(data)
// data is now { name: 'John', email: 'john@test.com' }
// Returns same reference as input
```

- Only removes `undefined` values -- `null`, `0`, `''`, `false` are preserved
- Uses `delete obj[key]` for removal

### isKeyOf -- Type Guard for Object Keys
```typescript
function isKeyOf<T extends object>(obj: T, k: keyof any): k is keyof T
```

Type guard that narrows `k` to `keyof T` if the key exists in `obj`. Uses `k in obj`.

```typescript
const config = { debug: true, verbose: false }
const key: string = 'debug'

if (isKeyOf(config, key)) {
  // TypeScript knows: key is 'debug' | 'verbose'
  console.log(config[key])  // type-safe access
}
```

### objectKeys -- Strictly Typed Object.keys
```typescript
function objectKeys<T extends object>(obj: T): Array<`${keyof T & (string | number | boolean | null | undefined)}`>
```

Returns `Object.keys(obj)` with a stricter return type than the built-in `Object.keys()` (which returns `string[]`).

```typescript
const user = { name: 'John', age: 30 }
const keys = objectKeys(user)
// Type: ('name' | 'age')[]  (not string[])
```

### objectEntries -- Strictly Typed Object.entries
```typescript
function objectEntries<T extends object>(obj: T): Array<[keyof T, T[keyof T]]>
```

Returns `Object.entries(obj)` with a stricter return type than the built-in `Object.entries()` (which returns `[string, any][]`).

```typescript
const user = { name: 'John', age: 30 }
const entries = objectEntries(user)
// Type: ['name' | 'age', string | number][]
```

### hasOwnProperty -- Safe Property Check
```typescript
function hasOwnProperty<T>(obj: T, v: PropertyKey): boolean
```

Null-safe wrapper around `Object.prototype.hasOwnProperty.call()`. Returns `false` if `obj` is `null` or `undefined`.

```typescript
hasOwnProperty({ a: 1 }, 'a')     // true
hasOwnProperty({ a: 1 }, 'b')     // false
hasOwnProperty(null, 'a')          // false (no throw)
hasOwnProperty(undefined, 'a')     // false (no throw)
```

## Gotchas
- `deepMerge` **mutates the target object** -- it does not create a new object. The return value is the same reference as `target`.
- `clearUndefined` **mutates the input object** -- it deletes properties in place.
- `objectPick` creates a NEW object -- original is not affected.
- `objectMap` creates a NEW object via `Object.fromEntries`.
- `deepMerge` does NOT deeply merge arrays -- arrays from source replace arrays in target entirely.
- `deepMerge` uses `isObject()` from `@stacksjs/validation` combined with `!Array.isArray()` to determine mergeability.
- `objectMap` can filter entries by returning `undefined` from the callback -- filtered via `notNullish` from `@stacksjs/utils`.
- `objectKeys` return type uses a template literal type to handle non-string keys.
- `clearUndefined` only removes `undefined` -- `null` values are preserved.
- `hasOwnProperty` accepts `null`/`undefined` objects without throwing.
- `objectPick` with `omitUndefined=false` (default) includes keys even if their values are `undefined`, as long as the key exists in the object.
- These utilities are also re-exported through `@stacksjs/utils`.
