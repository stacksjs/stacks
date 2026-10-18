import { afterEach, expect, it } from 'bun:test'
import { crypto } from '../src/crypto'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

it('obtains a UUID from the native service through the named SDK adapter', async () => {
  let calls = 0
  const id = '1735d054-9bd4-4fc0-a251-029265c04b28'
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { craft: { platform: 'android', crypto: { randomUUID: async () => {
      calls++
      return id
    } } } },
  })
  expect(await crypto.randomUUID()).toBe(id)
  expect(calls).toBe(1)
})

it('rejects an older native host without substituting browser randomness', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { craft: { platform: 'android' } } })
  await expect(crypto.randomUUID()).rejects.toMatchObject({ code: 'CRYPTO_UNSUPPORTED' })
})

it('preserves a native UUID failure', async () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { craft: { platform: 'ios', crypto: { randomUUID: async () => {
      throw Object.assign(new Error('System UUID unavailable'), { code: 'UUID_FAILED' })
    } } } },
  })
  await expect(crypto.randomUUID()).rejects.toMatchObject({ code: 'UUID_FAILED' })
})
