import { variadic } from './variadic'

/**
 * Delete keys helper
 *
 * Delete one or multiple keys from an object
 *
 * @param obj - The object from which to delete keys
 * @param keys - The keys to delete
 * @returns {void}
 */
export function deleteKeys<T extends object>(obj: T, ...keys: (keyof T)[]): void {
  variadic(keys).forEach((key) => {
    delete obj[key]
  })
}
