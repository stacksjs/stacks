/**
 * Returns the average of an array of numbers
 * @param arr
 * @category Array
 * @example
 * ```ts
 * average([1, 2, 3, 4]) // 2.5
 * ```
 */
export function average(arr: number[]): number {
  if (arr.length === 0)
    throw new Error('Cannot compute average of an empty array')
  const total = sum(arr)
  if (Number.isFinite(total) || arr.some(value => !Number.isFinite(value))) return total / arr.length
  // Scale finite inputs only when their intermediate sum overflows.
  const scale = arr.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0)
  return (arr.reduce((acc, value) => acc + value / scale, 0) / arr.length) * scale
}

/**
 * Returns the average of an array of numbers
 * @param arr
 * @category Array
 * @example
 * ```ts
 * avg([1, 2, 3, 4]) // 2.5
 * ```
 */
export function avg(arr: number[]): number {
  return average(arr)
}

/**
 * Returns the median of an array of numbers
 * @param arr
 * @category Array
 * @example
 * ```ts
 * median([1, 2, 3, 4]) // 2.5
 * ```
 */
export function median(arr: number[]): number {
  if (arr.length === 0)
    throw new Error('Cannot compute median of an empty array')

  const sorted = [...arr].sort((a, b) => a - b)

  const mid = Math.floor(sorted.length / 2)

  let medianValue: number

  if (sorted.length % 2 !== 0)
    medianValue = sorted[mid] as number
    else medianValue = average([sorted[mid] as number, sorted[mid - 1] as number])

  return medianValue
}

/**
 * Returns the mode of an array of numbers
 * @param arr
 * @category Array
 * @example
 * ```ts
 * mode([1, 2, 3, 4]) // 1
 * mode([1, 2, 2, 3, 4]) // 2
 * mode([1, 2, 2, 3, 3, 4]) // 2
 * mode([1, 2, 2, 3, 3, 4, 4]) // 2
 * mode([1, 2, 2, 3, 3, 4, 4, 4]) // 4
 * ```
 */
export function mode(arr: number[]): number {
  if (arr.length === 0)
    throw new Error('Cannot compute mode of an empty array')

  const counts = new Map<number, number>()
  for (const v of arr) {
    counts.set(v, (counts.get(v) || 0) + 1)
  }

  let maxCount = 0
  let result = arr[0] as number
  for (const [value, count] of counts) {
    if (count > maxCount) {
      maxCount = count
      result = value
    }
  }

  return result
}

/**
 * Returns the sum of an array of numbers
 * @param array
 * @category Array
 * @example
 * ```ts
 * sum([1, 2, 3, 4]) // 10
 * ```
 */
export function sum(array: readonly number[]): number {
  return array.reduce((acc, cur) => acc + cur, 0)
}

/**
 * Returns the product of an array of numbers.
 *
 * Throws when an intermediate product exceeds `Number.MAX_SAFE_INTEGER` —
 * silently returning a precision-lossy float made downstream comparisons
 * (e.g. inventory totals, distance calcs) lie without any signal that
 * the result was unreliable.
 *
 * @param array
 * @category Array
 * @example
 * ```ts
 * product([1, 2, 3, 4]) // 24
 * ```
 */
export function product(array: readonly number[]): number {
  let acc = 1
  for (const cur of array) {
    acc *= cur
    if (Number.isFinite(acc) && Math.abs(acc) > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(`[arrays.product] Result exceeds Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); use BigInt for large products.`)
    }
  }
  return acc
}

/**
 * Returns the minimum value of an array of numbers
 * @param array
 * @category Array
 * @example
 * ```ts
 * min([1, 2, 3, 4]) // 1
 * min([1, 2, 3, 4, -1]) // -1
 * ```
 */
export function min(array: readonly number[]): number {
  if (array.length === 0)
    throw new Error('Cannot compute min of an empty array')
  let result = Infinity
  for (const value of array) result = Math.min(result, value)
  return result
}

/**
 * Returns the maximum value of an array of numbers
 * @param array
 * @category Array
 * @example
 * ```ts
 * max([1, 2, 3, 4]) // 4
 * max([1, 2, 3, 4, -1]) // 4
 * ```
 */
export function max(array: readonly number[]): number {
  if (array.length === 0)
    throw new Error('Cannot compute max of an empty array')
  let result = -Infinity
  for (const value of array) result = Math.max(result, value)
  return result
}

/**
 * Returns the range of an array of numbers
 * @param array
 * @category Array
 * @example
 * ```ts
 * range([1, 2, 3, 4]) // 3
 * range([1, 2, 3, 4, -1]) // 5
 * range([1, 2, 3, 4, -1, 10]) // 11
 * ```
 */
export function range(array: readonly number[]): number {
  return max(array) - min(array)
}

/**
 * Returns the variance of an array of numbers
 * @param array
 * @category Array
 * @example
 * ```ts
 * variance([1, 2, 3, 4]) // 1.25
 * ```
 * @see https://en.wikipedia.org/wiki/Variance
 */
export function variance(array: number[]): number {
  const mean = average(array)
  return average(array.map(num => (num - mean) ** 2))
}

/**
 * Returns the standard deviation of an array of numbers
 * @param array
 * @category Array
 * @example
 * ```ts
 * standardDeviation([1, 2, 3, 4]) // 1.118033988749895
 * ```
 * @see https://en.wikipedia.org/wiki/Standard_deviation
 * @see https://stackoverflow.com/questions/7343890/standard-deviation-javascript
 */
export function standardDeviation(array: number[]): number {
  return Math.sqrt(variance(array))
}

/**
 * Returns the z-score of a number in an array of numbers: how many
 * (population) standard deviations it lies from the array's mean.
 * @param array
 * @param num
 * @category Array
 * @example
 * ```ts
 * zScore([1, 2, 3, 4], 2) // -0.4472135954999579
 * zScore([1, 2, 3, 4], 3) // 0.4472135954999579
 * ```
 * @see https://en.wikipedia.org/wiki/Standard_score
 */
export function zScore(array: number[], num: number): number {
  return (num - average(array)) / standardDeviation(array)
}

/**
 * Returns the value at the `num`-th percentile (0 to 100) of an array of
 * numbers, interpolating linearly between the two nearest ranks (the method
 * numpy uses by default). Throws for an empty array or a percentile outside
 * 0 to 100, which used to come back as a made-up 0 or an extrapolation.
 * @param array
 * @param num
 * @category Array
 * @example
 * ```ts
 * percentile([1, 2, 3, 4], 50) // 2.5
 * percentile([1, 2, 3, 4], 75) // 3.25
 * ```
 * @see https://en.wikipedia.org/wiki/Percentile
 */
export function percentile(array: number[], num: number): number {
  if (array.length === 0)
    throw new Error('Cannot compute a percentile of an empty array')
  if (!Number.isFinite(num) || num < 0 || num > 100)
    throw new RangeError(`A percentile is between 0 and 100, got ${num}`)

  const sorted = [...array].sort((a, b) => a - b)
  const index = (num / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower

  if (upper === lower)
    return sorted[index] ?? 0
  return (1 - weight) * (sorted[lower] ?? 0) + weight * (sorted[upper] ?? 0)
}

/**
 * Returns the interquartile range of an array of numbers: the median of the
 * upper half minus the median of the lower half, leaving out the middle value
 * of an odd-length array. The array is sorted first; the halves used to be
 * taken in the order given, so `[4, 1, 3, 2]` answered 0 and `[1, 2, 3, 4]` 2.
 * @param array
 * @category Array
 * @example
 * ```ts
 * interquartileRange([1, 2, 3, 4]) // 2
 * interquartileRange([1, 2, 3, 4, 5, 6, 7, 8]) // 4
 * ```
 * @see https://en.wikipedia.org/wiki/Interquartile_range
 */
export function interquartileRange(array: number[]): number {
  if (array.length === 0)
    throw new Error('Cannot compute the interquartile range of an empty array')
  // One value has no spread, and no lower or upper half to take a median of.
  if (array.length === 1)
    return 0

  const sorted = [...array].sort((a, b) => a - b)
  const q1 = median(sorted.slice(0, Math.floor(sorted.length / 2)))
  const q3 = median(sorted.slice(Math.ceil(sorted.length / 2)))
  return q3 - q1
}

/**
 * Returns the covariance of two arrays of numbers
 * @param array1
 * @param array2
 * @category Array
 * @example
 * ```ts
 * covariance([1, 2, 3, 4], [1, 2, 3, 4]) // 1.25
 * covariance([1, 2, 3, 4], [4, 3, 2, 1]) // -1.25
 * ```
 */
export function covariance(array1: number[], array2: number[]): number {
  if (array1.length !== array2.length)
    throw new Error('Arrays must have the same length')

  const mean1 = average(array1)
  const mean2 = average(array2)

  return average(array1.map((num1, i) => (num1 - mean1) * ((array2[i] as number) - mean2)))
}
