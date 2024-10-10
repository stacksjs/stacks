/**
 * Checks if the item is an array.
 * @param item - The item to check.
 * @returns A boolean indicating whether the item is an array.
 */
export const isArray = (item: unknown): item is Array<unknown> => Array.isArray(item)

/**
 * Checks if the item is an object (excluding arrays and null).
 * @param item - The item to check.
 * @returns A boolean indicating whether the item is an object.
 */
export function isObject(item: unknown): item is object {
  return typeof item === 'object' && !Array.isArray(item) && item !== null
}

/**
 * Checks if the item is a function.
 * @param item - The item to check.
 * @returns A boolean indicating whether the item is a function.
 */
// eslint-disable-next-line ts/no-unsafe-function-type
export const isFunction = (item: unknown): item is Function => typeof item === 'function'
