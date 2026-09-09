/**
 * Left-to-right function composition over a value.
 *
 * Distinct from `Pipeline` next door, which is Laravel's middleware pipeline: a
 * value passed through handlers that each take a `next`, all of the same type,
 * able to short-circuit. This is the other thing the word means - a value fed
 * through a series of transformations, each free to change the type, none of
 * them aware of the others.
 *
 * It is what the request to adopt Remeda (stacksjs/stacks#412) was really
 * asking for. The array and object operations it wanted are implemented in
 * `@stacksjs/arrays` and `@stacksjs/objects`; those are data-first, which reads
 * better on its own:
 *
 * ```ts
 * const top = take(sortBy(users, u => u.score), 3)
 * ```
 *
 * That inverts once there are more than two steps, because the first thing to
 * happen is written last. `pipe` restores the reading order without a second
 * library or a second set of every function:
 *
 * ```ts
 * const top = pipe(users, list => sortBy(list, u => u.score), list => take(list, 3))
 * ```
 *
 * Overloads carry the types through each step, so the result is inferred rather
 * than asserted. They stop at ten steps, and an eleventh is a compile error
 * rather than a silent `unknown` - which is a limit worth having, because a
 * pipeline that long is a function that wants a name.
 */

/**
 * The one place the step types are erased.
 *
 * Each overload above proves that step N accepts what step N-1 returned, so by
 * the time execution reaches here the chain is already known to line up. The
 * cast is that proof being discarded, not sidestepped - keeping it in a single
 * named function is what stops it spreading into either public signature.
 */
function runSteps(value: unknown, steps: ReadonlyArray<(input: never) => unknown>): unknown {
  let current = value
  for (const step of steps)
    current = (step as (input: unknown) => unknown)(current)
  return current
}

export function pipe<A>(value: A): A
export function pipe<A, B>(value: A, ab: (input: A) => B): B
export function pipe<A, B, C>(value: A, ab: (input: A) => B, bc: (input: B) => C): C
export function pipe<A, B, C, D>(value: A, ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D): D
export function pipe<A, B, C, D, E>(value: A, ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D, de: (input: D) => E): E
export function pipe<A, B, C, D, E, F>(value: A, ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D, de: (input: D) => E, ef: (input: E) => F): F
export function pipe<A, B, C, D, E, F, G>(value: A, ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D, de: (input: D) => E, ef: (input: E) => F, fg: (input: F) => G): G
export function pipe<A, B, C, D, E, F, G, H>(value: A, ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D, de: (input: D) => E, ef: (input: E) => F, fg: (input: F) => G, gh: (input: G) => H): H
export function pipe<A, B, C, D, E, F, G, H, I>(value: A, ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D, de: (input: D) => E, ef: (input: E) => F, fg: (input: F) => G, gh: (input: G) => H, hi: (input: H) => I): I
export function pipe<A, B, C, D, E, F, G, H, I, J>(value: A, ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D, de: (input: D) => E, ef: (input: E) => F, fg: (input: F) => G, gh: (input: G) => H, hi: (input: H) => I, ij: (input: I) => J): J
export function pipe(value: unknown, ...steps: ReadonlyArray<(input: never) => unknown>): unknown {
  return runSteps(value, steps)
}

/**
 * The same composition, without a value - a reusable function.
 *
 * `pipe` transforms something now; this builds the transformation to apply
 * later, which is what makes it usable as a callback:
 *
 * ```ts
 * const normalize = piped(
 *   (name: string) => name.trim(),
 *   name => name.toLowerCase(),
 * )
 *
 * names.map(normalize)
 * ```
 *
 * The first step's parameter type is what the resulting function accepts, so it
 * has to be annotated - there is nothing else for inference to work from.
 */
export function piped<A, B>(ab: (input: A) => B): (input: A) => B
export function piped<A, B, C>(ab: (input: A) => B, bc: (input: B) => C): (input: A) => C
export function piped<A, B, C, D>(ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D): (input: A) => D
export function piped<A, B, C, D, E>(ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D, de: (input: D) => E): (input: A) => E
export function piped<A, B, C, D, E, F>(ab: (input: A) => B, bc: (input: B) => C, cd: (input: C) => D, de: (input: D) => E, ef: (input: E) => F): (input: A) => F
export function piped(...steps: ReadonlyArray<(input: never) => unknown>): (input: unknown) => unknown {
  return (input: unknown) => runSteps(input, steps)
}

/**
 * Run a side effect on a value and hand the value back.
 *
 * For inspecting a pipeline without breaking it - the step that logs, or
 * records a metric, and does not change what flows on:
 *
 * ```ts
 * pipe(
 *   users,
 *   list => sortBy(list, u => u.score),
 *   tap(list => log.debug(`${list.length} users`)),
 *   list => take(list, 3),
 * )
 * ```
 *
 * The effect's return value is discarded on purpose. A step that means to
 * change the value should be an ordinary step, where the type says so.
 */
export function tap<T>(effect: (value: T) => unknown): (value: T) => T {
  return (value: T) => {
    effect(value)
    return value
  }
}
