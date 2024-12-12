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
  return sum(arr) / arr.length
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
  else medianValue = ((sorted[mid] as number) + (sorted[mid - 1] as number)) / 2 // or (sorted[mid - 1] + sorted[mid]) / 2

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
  return arr.sort((a, b) => arr.filter(v => v === a).length - arr.filter(v => v === b).length).pop() as number
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
 * Returns the product of an array of numbers
 * @param array
 * @category Array
 * @example
 * ```ts
 * product([1, 2, 3, 4]) // 24
 * ```
 */
export function product(array: readonly number[]): number {
  return array.reduce((acc, cur) => acc * cur, 1)
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
  return Math.min(...array)
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
  return Math.max(...array)
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
 * Returns the z-score of a number in an array of numbers
 * @param array
 * @param num
 * @category Array
 * @example
 * ```ts
 * zScore([1, 2, 3, 4], 2) // 0
 * zScore([1, 2, 3, 4], 3) // 0.7071067811865475
 * ```
 * @see https://en.wikipedia.org/wiki/Standard_score
 */
export function zScore(array: number[], num: number): number {
  return (num - average(array)) / standardDeviation(array)
}

/**
 * Returns the percentile of a number in an array of numbers
 * @param array
 * @param num
 * @category Array
 * @example
 * ```ts
 * percentile([1, 2, 3, 4], 2) // 0.25
 * percentile([1, 2, 3, 4], 3) // 0.75
 * ```
 * @see https://en.wikipedia.org/wiki/Percentile
 */
export function percentile(array: number[], num: number): number {
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
 * Returns the interquartile range of an array of numbers
 * @param array
 * @category Array
 * @example
 * ```ts
 * interquartileRange([1, 2, 3, 4]) // 1.5
 * ```
 * @see https://en.wikipedia.org/wiki/Interquartile_range
 * @see https://stackoverflow.com/questions/48719873/how-to-calculate-interquartile-range-in-javascript
 */
export function interquartileRange(array: number[]): number {
  const q1 = median(array.slice(0, Math.floor(array.length / 2)))
  const q3 = median(array.slice(Math.ceil(array.length / 2)))
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
