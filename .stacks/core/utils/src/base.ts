export { toString } from '@stacksjs/strings'

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition)
    throw new Error(message)
}

// export function noop() {}

export function loop(times: number, callback: any) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  [...Array(times)].forEach((item, i) => callback(i))
}
