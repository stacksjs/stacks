import process from 'node:process'
import { afterEach, describe, expect, it } from 'bun:test'
import { appEnv, isDevelopment, isLocal, isProduction, isStaging, isTesting } from '../src/utils'

const original = { APP_ENV: process.env.APP_ENV, NODE_ENV: process.env.NODE_ENV }

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }
})

function as(appEnvValue: string | undefined, nodeEnv?: string): void {
  if (appEnvValue === undefined)
    delete process.env.APP_ENV
  else
    process.env.APP_ENV = appEnvValue

  if (nodeEnv === undefined)
    delete process.env.NODE_ENV
  else
    process.env.NODE_ENV = nodeEnv
}

describe('appEnv', () => {
  it('reads APP_ENV at CALL time, not at import time', () => {
    // The whole reason these are functions: a test harness or a CLI resolving
    // --env sets APP_ENV long after this module was first imported, and a
    // const would report whatever was set back then for the rest of the run.
    as('production')
    expect(appEnv()).toBe('production')
    as('staging')
    expect(appEnv()).toBe('staging')
  })

  it('falls back to NODE_ENV, which a plain `bun test` sets', () => {
    as(undefined, 'test')
    expect(appEnv()).toBe('test')
    expect(isTesting()).toBe(true)
  })

  it('defaults to local when nothing is set', () => {
    as(undefined, undefined)
    expect(appEnv()).toBe('local')
    expect(isLocal()).toBe(true)
  })
})

describe('environment predicates', () => {
  it('treats local as development', () => {
    // Stacks uses `local` where other frameworks use `development`, so a check
    // for one that missed the other would be a trap.
    as('local')
    expect(isDevelopment()).toBe(true)
    expect(isLocal()).toBe(true)
  })

  it('does not treat development as local', () => {
    as('development')
    expect(isDevelopment()).toBe(true)
    expect(isLocal()).toBe(false)
  })

  it('accepts the abbreviated names', () => {
    as('dev')
    expect(isDevelopment()).toBe(true)
    as('prod')
    expect(isProduction()).toBe(true)
    as('testing')
    expect(isTesting()).toBe(true)
  })

  it('is mutually exclusive across the real environments', () => {
    for (const [name, expected] of [
      ['production', isProduction],
      ['staging', isStaging],
      ['test', isTesting],
    ] as const) {
      as(name)
      expect(expected()).toBe(true)
      // Nothing else should also claim it.
      const others = [isProduction, isStaging, isTesting, isLocal].filter(fn => fn !== expected)
      expect(others.some(fn => fn())).toBe(false)
    }
  })
})
