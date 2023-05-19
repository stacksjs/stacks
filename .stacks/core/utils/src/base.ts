// imported through vitest already
// export function assert(condition: boolean, message: string): asserts condition {
//   if (!condition)
//     throw new Error(message)
// }

export function toString(v: any) {
  return Object.prototype.toString.call(v)
}

export function noop() {}

export function loop(times: number, callback: any) {
  [...Array(times)].forEach((item, i) => callback(i))
}

export function getTypeName(v: any) {
  if (v === null)
    return 'null'
  const type = toString(v).slice(8, -1).toLowerCase()

  return (typeof v === 'object' || typeof v === 'function')
    ? type
    : typeof v
}
