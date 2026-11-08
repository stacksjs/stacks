import { describe, expect, it } from 'bun:test'
import { DEFAULT_POOL_IDLE_TIMEOUT_MS, resolvePoolConfig } from '../src/pool-defaults'

describe('resolvePoolConfig', () => {
  it('closes idle connections when the app declares no pool', () => {
    expect(resolvePoolConfig(undefined)).toEqual({ idleTimeoutMs: DEFAULT_POOL_IDLE_TIMEOUT_MS })
  })

  it('keeps the idle timeout under a pool that only sets other knobs', () => {
    expect(resolvePoolConfig({ preparedStatements: false })).toEqual({ idleTimeoutMs: DEFAULT_POOL_IDLE_TIMEOUT_MS, preparedStatements: false })
  })

  it('lets the app config override the default', () => {
    expect(resolvePoolConfig({ max: 20, idleTimeoutMs: 5_000 })).toEqual({ max: 20, idleTimeoutMs: 5_000 })
  })

  it('lets the process environment override the config', () => {
    expect(resolvePoolConfig({ max: 10 }, { DB_POOL_MAX: '2', DB_POOL_IDLE_TIMEOUT_MS: 10_000 })).toEqual({ max: 2, idleTimeoutMs: 10_000 })
  })

  it('ignores empty, zero and malformed environment values', () => {
    expect(resolvePoolConfig({ max: 10 }, { DB_POOL_MAX: '', DB_POOL_IDLE_TIMEOUT_MS: 0, DB_POOL_ACQUIRE_TIMEOUT_MS: 'soon' })).toEqual({ max: 10, idleTimeoutMs: DEFAULT_POOL_IDLE_TIMEOUT_MS })
  })

  it('never hands the driver an undefined knob', () => {
    expect(Object.values(resolvePoolConfig({ max: undefined }))).not.toContain(undefined)
  })
})
