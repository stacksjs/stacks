/**
 * Throttle a function.
 *
 * @param fn
 * @param wait
 * @returns
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
 */
export function throttle(fn: Function, wait = 300) {
  let inThrottle: boolean
  let lastFn: ReturnType<typeof setTimeout>
  let lastTime: number

  return function (this: unknown, ...args: any[]) {
    if (!inThrottle) {
      fn.apply(this, args)

      lastTime = Date.now()
      inThrottle = true
    }
    else {
      clearTimeout(lastFn)

      lastFn = setTimeout(() => {
        if (Date.now() - lastTime >= wait) {
          fn.apply(this, args) // Use 'this' directly
          lastTime = Date.now()
        }
      }, Math.max(wait - (Date.now() - lastTime), 0))
    }
  }
}
