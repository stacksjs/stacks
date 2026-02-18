declare const state: any
declare function now(): string
// reactive state
export const count = state(0)

// functions that mutate state and trigger updates
export function increment() {
  console.log('increment() was last run:', now())
  count.value++
}
