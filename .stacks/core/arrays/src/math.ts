export function average(arr: number[]): number {
  return sum(arr) / arr.length
}

export function avg(arr: number[]): number {
  return average(arr)
}

export function median(arr: number[]): number {
  return arr[Math.floor(arr.length / 2)]
}

export function mode(arr: number[]): number {
  return arr.sort((a, b) => arr.filter(v => v === a).length - arr.filter(v => v === b).length).pop()!
}

export function sum(array: readonly number[]): number {
  return array.reduce((acc, cur) => acc + cur, 0)
}
