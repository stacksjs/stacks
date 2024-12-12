export { toString } from '@stacksjs/strings'

// export function assert(condition: boolean, message: string): asserts condition {
//   if (!condition)
//     throw new Error(message)
// }

// export function noop() {}

export async function loop(times: number, callback: any): Promise<void> {
  Array.from({ length: times }).forEach(async (_, i) => await callback(i))
}
