/**
 * Clone helper
 *
 * Clone an array or object
 *
 * @param items - The array or object to clone
 * @returns A deep clone of the input
 */
export function clone<T>(items: T[]): T[]
export function clone<T extends object>(items: T): T
export function clone<T>(items: T[] | T): T[] | T {
  if (Array.isArray(items)) {
    return [...items]
  }

  return { ...items }
}
