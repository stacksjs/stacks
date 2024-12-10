/**
 * Lazily evaluate a value.
 * @param getter A function that returns the value to be lazily evaluated.
 * @returns An object with a `value` property that contains the lazily evaluated value.
 */
export function lazy<T>(getter: () => T): { value: T } {
  return {
    get value() {
      const value = getter()
      Object.defineProperty(this, 'value', { value })
      return value
    },
  }
}
