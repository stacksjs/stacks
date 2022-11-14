// export const assert = (condition: boolean, message: string): asserts condition => {
//   if (!condition)
//     throw new Error(message)
// }
export const toString = (v: any) => Object.prototype.toString.call(v)
// export const noop = () => {}

export const loop = (times: number, callback: any) => {
  [...Array(times)].forEach((item, i) => callback(i))
}
