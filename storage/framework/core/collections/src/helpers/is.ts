export const is = {
  /**
   * Checks if the item is an array.
   * @param item - The item to check.
   * @returns A boolean indicating whether the item is an array.
   */
  isArray: (item: unknown): item is Array<unknown> => Array.isArray(item),

  /**
   * Checks if the item is an object (excluding arrays and null).
   * @param item - The item to check.
   * @returns A boolean indicating whether the item is an object.
   */
  isObject: (item: unknown): item is object => typeof item === 'object' && !Array.isArray(item) && item !== null,

  /**
   * Checks if the item is a function.
   * @param item - The item to check.
   * @returns A boolean indicating whether the item is a function.
   */
  isFunction: (item: unknown): item is Function => typeof item === 'function',
}
