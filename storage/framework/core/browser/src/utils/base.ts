export { toString } from '@stacksjs/strings'

// export function assert(condition: boolean, message: string): asserts condition {
//   if (!condition)
//     throw new Error(message)
// }

// export function noop() {}

export async function loop(times: number, callback: any): Promise<void> {
  ;[...new Array(times)].forEach(async (item, i) => await callback(i))
}
