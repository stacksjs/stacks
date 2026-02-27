/**
 * Clone a value using JSON serialization.
 * Works for JSON-serializable values (no functions, symbols, etc).
 */
export function cloneFnJSON<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
