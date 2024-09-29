/**
 * Values helper
 *
 * Retrieve values from items when it is an array, object or Collection
 *
 * @param items - The input array, object, or Collection
 * @returns An array of values
 */
export function values<T>(items: T[] | { [key: string]: T } | { all: () => T[] }): T[] {
  if (Array.isArray(items)) {
    return [...items]
  }

  if ('all' in items && typeof items.all === 'function') {
    return items.all()
  }

  return Object.values(items)
}
