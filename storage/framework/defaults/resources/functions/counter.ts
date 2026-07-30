export const count = state(0)

export function increment(): void {
  // eslint-disable-next-line no-console
  console.log('increment() was run')

  count.update(value => value + 1)
}
