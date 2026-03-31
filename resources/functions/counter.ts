// Reactive counter — uses stx signals (globals from stx.d.ts)
export const count = state(0)

export function increment() {
  count.update((n: number) => n + 1)
}

export function decrement() {
  count.update((n: number) => n - 1)
}

export function reset() {
  count.set(0)
}
