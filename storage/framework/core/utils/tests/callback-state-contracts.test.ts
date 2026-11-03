import { expect, test } from 'bun:test'
import { debounce, throttle } from '../src/debounce'

test('debounced callbacks retain work queued reentrantly and flush returns each result', () => {
  const seen: string[] = []
  const fn = debounce((value: string): number => { seen.push(value); if (value === 'first') fn('second'); return seen.length }, 50)
  try {
    expect(fn('first')).toBeUndefined()
    expect(fn.flush()).toBe(1)
    expect(fn.flush()).toBe(2)
    expect(seen).toEqual(['first', 'second'])
  }
  finally { fn.cancel() }
})

test('a throwing leading call is not replayed as pending trailing work', () => {
  let calls = 0
  const fn = debounce(() => { calls++; throw new Error('failed') }, 50, { leading: true })
  try {
    expect(() => fn()).toThrow('failed')
    expect(() => fn.flush()).not.toThrow()
    expect(calls).toBe(1)
  }
  finally { fn.cancel() }
})

test('throttled callbacks return cached results and defer reentrant work', async () => {
  const seen: string[] = []
  const fn = throttle((value: string): string => { seen.push(value); if (value === 'first') fn('second'); return value }, 5)
  try {
    expect(fn('first')).toBe('first')
    expect(seen).toEqual(['first'])
    await Bun.sleep(20)
    expect(seen).toEqual(['first', 'second'])
  }
  finally { fn.cancel() }
})

test('rate controls retain this and async result values', async () => {
  const owner = { value: 4, run: debounce(async function (this: { value: number }, add: number) { return this.value + add }, 50) }
  expect(owner.run(3)).toBeUndefined()
  expect(await owner.run.flush()).toBe(7)
  owner.run.cancel()
  const limited = throttle(async (value: number) => value + 1, 50)
  try { expect(await limited(2)).toBe(3); expect(await limited(9)).toBe(3) }
  finally { limited.cancel() }
})
