import { state } from '@stacksjs/stx'

export const count = state(0)

export function increment(): void {
  count.update(value => value + 1)
}
