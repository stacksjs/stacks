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
export const throttle = (fn: Function, wait: number = 300) => {
  let inThrottle: boolean
  let lastFn: ReturnType<typeof setTimeout>
  let lastTime: number

  return function (this: any) {
    const context = this
    const args = arguments

    if (!inThrottle) {
      fn.apply(context, args)

      lastTime = Date.now()
      inThrottle = true
    } else {
      clearTimeout(lastFn)

      lastFn = setTimeout(() => {
        if (Date.now() - lastTime >= wait) {
          fn.apply(context, args)
          lastTime = Date.now()
        }
      }, Math.max(wait - (Date.now() - lastTime), 0))
    }
  }
}
