/**
 * Variadic helper function
 *
 * @param args - The arguments to process
 * @returns An array of the processed arguments
 */
export function variadic<T>(args: T[] | T): T[] {
  if (Array.isArray(args)) {
    return args
  }

  return [args]
}
