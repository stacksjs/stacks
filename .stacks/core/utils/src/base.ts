export const assert = (condition: boolean, message: string): asserts condition => {
  if (!condition)
    throw new Error(message)
}

export const toString = (v: any) => Object.prototype.toString.call(v)

export const noop = () => {}

export const loop = (times: number, callback: any) => {
  [...Array(times)].forEach((item, i) => callback(i))
}

export const getTypeName = (v: any) => {
  if (v === null)
    return 'null'
  const type = toString(v).slice(8, -1).toLowerCase()
  return typeof v === 'object' || (typeof v === 'function' ? type : typeof v)
}
