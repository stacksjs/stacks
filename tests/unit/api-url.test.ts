import { afterEach, describe, expect, test } from 'bun:test'
import { resolveApiBaseUrl } from '../../storage/framework/defaults/functions/api-url'

const browserGlobal = globalThis as typeof globalThis & {
  __STACKS_API_URL__?: string
}

afterEach(() => {
  delete browserGlobal.__STACKS_API_URL__
})

describe('resolveApiBaseUrl', () => {
  test('uses the framework-injected browser API URL', () => {
    browserGlobal.__STACKS_API_URL__ = 'https://api.stacks.test/v1/'

    expect(resolveApiBaseUrl()).toBe('https://api.stacks.test/v1')
  })

  test('uses a relative API root outside the browser', () => {
    expect(resolveApiBaseUrl()).toBe('/api')
  })

  test('supports framework routes mounted at the origin', () => {
    expect(resolveApiBaseUrl('')).toBe('')
  })
})
