import { describe, expect, it } from 'bun:test'
import { Feature } from '../src'

describe('configured global Feature facade', () => {
  it('loads config lazily and uses the configured driver', async () => {
    Feature.define('global-facade-test', true)
    expect(await Feature.active('global-facade-test', 'test-scope')).toBe(true)
    await Feature.forget('global-facade-test', 'test-scope')
    Feature.clearDefinitions()
  })
})
