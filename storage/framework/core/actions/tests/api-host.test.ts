import { describe, expect, it } from 'bun:test'
import { resolveApiHost } from '../src/helpers/api-host'

describe('resolveApiHost', () => {
  it('keeps development servers local by default', () => {
    expect(resolveApiHost({})).toBe('127.0.0.1')
  })

  it('binds production servers to all interfaces by default', () => {
    expect(resolveApiHost({ APP_ENV: 'production' })).toBe('0.0.0.0')
    expect(resolveApiHost({ NODE_ENV: 'production' })).toBe('0.0.0.0')
  })

  it('supports API_HOST and the conventional HOST fallback', () => {
    expect(resolveApiHost({ API_HOST: '10.0.0.8', HOST: '127.0.0.1' })).toBe('10.0.0.8')
    expect(resolveApiHost({ HOST: '::' })).toBe('::')
  })
})
