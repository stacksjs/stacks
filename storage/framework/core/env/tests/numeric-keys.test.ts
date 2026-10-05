import { afterEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { defineEnv, env, FRAMEWORK_NUMERIC_ENV_KEYS } from '../src'

/**
 * A variable typed `number` is a number at runtime.
 *
 * The proxy coerced by name suffix only, so 21 of the 26 framework variables
 * typed `number` came back as strings. `AUTH_TOKEN_EXPIRY=7200000` made
 * `Date.now() + tokenExpiry` a string concatenation and every token an
 * `Invalid Date`.
 */
const touched: string[] = []
function set(key: string, value: string): void {
  touched.push(key)
  process.env[key] = value
}

afterEach(() => {
  for (const key of touched.splice(0))
    delete process.env[key]
})

describe('numeric environment variables', () => {
  it('lists every variable types.ts declares as a number, and nothing else', () => {
    const source = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8')
    const declared = [...source.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*number(?:\s*\|\s*undefined)?\s*$/gm)].map(match => match[1]!)

    expect(declared.length).toBeGreaterThan(20)
    expect([...FRAMEWORK_NUMERIC_ENV_KEYS].sort()).toEqual([...new Set(declared)].sort())
  })

  it('hands the auth lifetimes over as numbers', () => {
    set('AUTH_TOKEN_EXPIRY', '7200000')
    set('AUTH_PASSWORD_RESET_EXPIRE', '30')

    expect(env.AUTH_TOKEN_EXPIRY).toBe(7200000)
    expect(env.AUTH_PASSWORD_RESET_EXPIRE).toBe(30)
    expect(Number.isNaN(new Date(Date.now() + (env.AUTH_TOKEN_EXPIRY as number)).getTime())).toBe(false)
  })

  it('reads PORT_* as numbers, though the word is a prefix', () => {
    set('PORT_API', '3008')
    expect(env.PORT_API).toBe(3008)
  })

  it('keeps zero and decimals for a declared number', () => {
    set('AUTH_TOKEN_ROTATION', '0')
    set('STRIPE_CONNECT_FEE_PERCENT', '2.5')

    expect(env.AUTH_TOKEN_ROTATION).toBe(0)
    expect(env.STRIPE_CONNECT_FEE_PERCENT).toBe(2.5)
  })

  it('reads zero for a suffix-named setting, but keeps other leading zeros as text', () => {
    set('STACKS_PROBE_RETRIES', '0')
    set('STACKS_PROBE_TIMEOUT', '0042')

    expect((env as Record<string, unknown>).STACKS_PROBE_RETRIES).toBe(0)
    expect((env as Record<string, unknown>).STACKS_PROBE_TIMEOUT).toBe('0042')
  })

  it('treats a variable config/env.ts validates as a number as one', () => {
    defineEnv({ STACKS_PROBE_WIDGETS: { validation: { name: 'number' } as never, default: 0 } } as never)
    set('STACKS_PROBE_WIDGETS', '12')

    expect((env as Record<string, unknown>).STACKS_PROBE_WIDGETS).toBe(12)
  })

  it('leaves a declared number that is not numeric alone', () => {
    set('PORT_API', 'auto')
    expect(env.PORT_API as unknown).toBe('auto')
  })
})
