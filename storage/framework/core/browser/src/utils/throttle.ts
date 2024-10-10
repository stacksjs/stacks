/**
 * Throttle a function.
 *
 * @param {Function} fn - The function to throttle.
 * @param {number} [wait] - The time to wait between function calls.
 * @returns {Function} - A new function that throttles the calls to the original function.
 *
 * @example
 * ```ts
 * // logs window dimensions at most every 250ms
 * window.addEventListener(
 *   "resize",
 *   throttle(function (evt) {
 *     console.log(window.innerWidth)
 *     console.log(window.innerHeight)
 *   }, 250)
 * )
 * ```
 */
// eslint-disable-next-line ts/no-unsafe-function-type
export function throttle(fn: Function, wait = 300) {
  let inThrottle: boolean
  let lastFn: ReturnType<typeof setTimeout>
  let lastTime: number

  return function (this: unknown, ...args: any[]): void {
    if (!inThrottle) {
      fn.apply(this, args)

      lastTime = Date.now()
      inThrottle = true
    }
    else {
      clearTimeout(lastFn)

      lastFn = setTimeout(
        () => {
          if (Date.now() - lastTime >= wait) {
            fn.apply(this, args) // Use 'this' directly
            lastTime = Date.now()
          }
        },
        Math.max(wait - (Date.now() - lastTime), 0),
      )
    }
  }
}
