/**
 * Make an object that can be destructured as both an object and an array.
 *
 * @param obj - The object with named properties
 * @param arr - The array with positional values
 * @returns A value that supports both object and array destructuring
 *
 * @example
 * ```ts
 * const result = makeDestructurable(
 *   { x: 1, y: 2 } as const,
 *   [1, 2] as const,
 * )
 * const { x, y } = result     // object destructuring
 * const [a, b] = result        // array destructuring
 * ```
 */
export function makeDestructurable<
  T extends Record<string, unknown>,
  A extends readonly unknown[],
>(obj: T, arr: A): T & A {
  const clone = { ...obj } as any

  Object.defineProperty(clone, Symbol.iterator, {
    enumerable: false,
    value() {
      let index = 0
      return {
        next: () => ({
          value: arr[index++],
          done: index > arr.length,
        }),
      }
    },
  })

  return clone as T & A
}
