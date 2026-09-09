/**
 * Reshaping an object: selecting parts of it, rewriting its keys or values,
 * reading and writing through a path.
 *
 * The counterpart to `arrays/src/transform.ts`, and the same answer to the same
 * request (stacksjs/stacks#412): the operations an application kept writing
 * inline, implemented in the package that already owns this surface rather than
 * imported from a second utility library.
 *
 * Everything here is immutable and shallow unless its own documentation says
 * otherwise. Only an object's own enumerable string keys are visited -
 * inherited and symbol keys are left alone, which matches `Object.entries` and
 * is what stops a plain-object helper from wandering into a prototype.
 */

/**
 * A copy without the given keys.
 *
 * The inverse of `objectPick`. Keys that are not present are ignored rather
 * than an error, so a caller can omit a superset without checking first.
 *
 * @category Object
 * @example
 * ```ts
 * omit({ a: 1, b: 2, c: 3 }, ['b']) // { a: 1, c: 3 }
 * ```
 */
export function omit<O extends object, K extends keyof O>(obj: O, keys: readonly K[]): Omit<O, K> {
  const excluded = new Set<PropertyKey>(keys)
  const result = {} as Omit<O, K>

  for (const [key, value] of Object.entries(obj)) {
    if (!excluded.has(key))
      (result as Record<string, unknown>)[key] = value
  }

  return result
}

/**
 * A copy keeping only the entries the predicate accepts.
 *
 * @category Object
 * @example
 * ```ts
 * pickBy({ a: 1, b: 2 }, value => value > 1) // { b: 2 }
 * ```
 */
export function pickBy<O extends object>(
  obj: O,
  predicate: (value: O[keyof O], key: keyof O & string) => boolean,
): Partial<O> {
  const result: Partial<O> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (predicate(value as O[keyof O], key as keyof O & string))
      (result as Record<string, unknown>)[key] = value
  }

  return result
}

/**
 * A copy dropping the entries the predicate accepts.
 *
 * The complement of {@link pickBy} - the same predicate partitions an object
 * between the two.
 *
 * @category Object
 * @example
 * ```ts
 * omitBy({ a: 1, b: undefined }, value => value === undefined) // { a: 1 }
 * ```
 */
export function omitBy<O extends object>(
  obj: O,
  predicate: (value: O[keyof O], key: keyof O & string) => boolean,
): Partial<O> {
  return pickBy(obj, (value, key) => !predicate(value, key))
}

/**
 * A copy with every value replaced by what `transform` returns.
 *
 * Keys are untouched, which is what distinguishes this from `objectMap` and
 * makes the result's type exact: `Record<keyof O, R>` rather than something
 * that depends on what the callback did with the key.
 *
 * @category Object
 * @example
 * ```ts
 * mapValues({ a: 1, b: 2 }, value => value * 10) // { a: 10, b: 20 }
 * ```
 */
export function mapValues<O extends object, R>(
  obj: O,
  transform: (value: O[keyof O], key: keyof O & string) => R,
): { [K in keyof O]: R } {
  const result = {} as { [K in keyof O]: R }

  for (const [key, value] of Object.entries(obj))
    (result as Record<string, unknown>)[key] = transform(value as O[keyof O], key as keyof O & string)

  return result
}

/**
 * A copy with every key replaced by what `transform` returns.
 *
 * Two keys can collide once rewritten; the last one visited wins, matching what
 * an assignment loop would do.
 *
 * @category Object
 * @example
 * ```ts
 * mapKeys({ a: 1, b: 2 }, key => key.toUpperCase()) // { A: 1, B: 2 }
 * ```
 */
export function mapKeys<O extends object, K extends PropertyKey>(
  obj: O,
  transform: (key: keyof O & string, value: O[keyof O]) => K,
): Record<K, O[keyof O]> {
  const result = {} as Record<K, O[keyof O]>

  for (const [key, value] of Object.entries(obj))
    result[transform(key as keyof O & string, value as O[keyof O])] = value as O[keyof O]

  return result
}

/**
 * Swap keys and values.
 *
 * Every value becomes a key, so values are coerced to strings by the assignment
 * - `{ a: 1 }` inverts to `{ '1': 'a' }`. Duplicate values collapse, last one
 * winning, which is why this is only meaningful for an object whose values are
 * unique.
 *
 * @category Object
 * @example
 * ```ts
 * invert({ a: 'x', b: 'y' }) // { x: 'a', y: 'b' }
 * ```
 */
export function invert<O extends Record<string, PropertyKey>>(obj: O): Record<string, keyof O & string> {
  const result: Record<string, keyof O & string> = {}

  for (const [key, value] of Object.entries(obj))
    result[String(value)] = key as keyof O & string

  return result
}

/**
 * Whether an object has no own enumerable string keys.
 *
 * Named for what it checks rather than the broader "is this empty" this could
 * have been: a single helper that also answers for strings, arrays, Maps and
 * Sets reads well at the call site and badly everywhere else, because the
 * reader cannot tell which question is being asked.
 *
 * @category Object
 * @example
 * ```ts
 * isEmptyObject({})       // true
 * isEmptyObject({ a: 1 }) // false
 * ```
 */
export function isEmptyObject(obj: object): boolean {
  for (const _key in obj) {
    if (Object.hasOwn(obj, _key))
      return false
  }
  return true
}

/** One step of a path: an object key or an array index. */
export type PathStep = string | number

/**
 * Read through a path, answering `fallback` when any step is missing.
 *
 * The path is an array of steps rather than a dotted string, deliberately: a
 * dotted string cannot express a key that contains a dot, and every
 * implementation that parses one eventually has to grow an escape syntax.
 *
 * A `null` or `undefined` anywhere along the way ends the walk and yields the
 * fallback, so this never throws on a partially-populated object - which is the
 * entire reason to use it instead of `a?.b?.c`.
 *
 * @category Object
 * @example
 * ```ts
 * getPath({ a: { b: [10, 20] } }, ['a', 'b', 1], 0) // 20
 * getPath({ a: {} }, ['a', 'b', 'c'], 'default')    // 'default'
 * ```
 */
export function getPath<T>(source: unknown, path: readonly PathStep[], fallback: T): T
export function getPath(source: unknown, path: readonly PathStep[]): unknown
export function getPath(source: unknown, path: readonly PathStep[], fallback?: unknown): unknown {
  let current = source

  for (const step of path) {
    if (current === null || current === undefined)
      return fallback
    current = (current as Record<PropertyKey, unknown>)[step]
  }

  return current === undefined ? fallback : current
}

/**
 * A copy with the value at `path` replaced, creating missing steps on the way.
 *
 * Only the objects along the path are copied - siblings are shared with the
 * original, which is what makes this cheap enough to use on every update. A
 * numeric step creates an array where a step is missing, so
 * `setPath({}, ['items', 0], x)` produces `{ items: [x] }` rather than
 * `{ items: { 0: x } }`.
 *
 * @category Object
 * @example
 * ```ts
 * setPath({ a: { b: 1 } }, ['a', 'b'], 2)  // { a: { b: 2 } }
 * setPath({}, ['a', 'b'], 1)               // { a: { b: 1 } }
 * ```
 */
export function setPath<O extends object>(source: O, path: readonly PathStep[], value: unknown): O {
  if (path.length === 0)
    return value as O

  const [step, ...rest] = path as [PathStep, ...PathStep[]]
  const container: Record<PropertyKey, unknown> = Array.isArray(source)
    ? [...source] as unknown as Record<PropertyKey, unknown>
    : { ...(source as object) } as Record<PropertyKey, unknown>

  if (rest.length === 0) {
    container[step] = value
    return container as O
  }

  const existing = container[step]
  const child = (existing === null || typeof existing !== 'object')
    ? (typeof rest[0] === 'number' ? [] : {})
    : existing

  container[step] = setPath(child as object, rest, value)
  return container as O
}
