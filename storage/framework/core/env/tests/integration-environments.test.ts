/**
 * The shared integration environment gate (stacksjs/stacks#2792).
 *
 * `APP_ENV` and `NODE_ENV` are both set and restored around every case. `bun
 * test` sets `NODE_ENV=test` itself, so a case about an undeclared environment
 * has to clear both - clearing only `APP_ENV` leaves the gate reading `test` and
 * tests something else while looking like it passed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  integrationEnvironment,
  integrationGate,
  normalizeEnvironmentName,
  REMOTE_TELEMETRY_ENVIRONMENTS,
} from '../src/integrations'

let savedAppEnv: string | undefined
let savedNodeEnv: string | undefined

beforeEach(() => {
  savedAppEnv = process.env.APP_ENV
  savedNodeEnv = process.env.NODE_ENV
})

afterEach(() => {
  if (savedAppEnv === undefined)
    delete process.env.APP_ENV
  else process.env.APP_ENV = savedAppEnv
  if (savedNodeEnv === undefined)
    delete process.env.NODE_ENV
  else process.env.NODE_ENV = savedNodeEnv
})

function runningAs(name: string | undefined): void {
  if (name === undefined) {
    delete process.env.APP_ENV
    delete process.env.NODE_ENV
    return
  }
  process.env.APP_ENV = name
}

describe('integration environment allowlist', () => {
  it('admits a deployed environment and excludes a developer machine by default', () => {
    runningAs('production')
    expect(integrationGate({})).toEqual({ enabled: true, environment: 'production', reason: 'environment-allowed' })

    runningAs('staging')
    expect(integrationGate({}).enabled).toBe(true)

    for (const name of ['local', 'development', 'test']) {
      runningAs(name)
      expect(integrationGate({}), name).toEqual({
        enabled: false,
        environment: name,
        reason: 'environment-excluded',
      })
    }
  })

  it('lets an explicit allowlist opt a developer machine in', () => {
    runningAs('local')
    expect(integrationGate({ environments: ['production', 'local'] }).enabled).toBe(true)
  })

  it('does not equate local, development and test', () => {
    // Three different places with three different reasons to be excluded.
    // Allowing one must not allow the others.
    runningAs('development')
    expect(integrationGate({ environments: ['local'] }).enabled).toBe(false)
    runningAs('test')
    expect(integrationGate({ environments: ['local', 'development'] }).enabled).toBe(false)
    runningAs('local')
    expect(integrationGate({ environments: ['local'] }).enabled).toBe(true)
  })

  it('supports a custom environment name', () => {
    runningAs('preview-42')
    expect(integrationGate({ environments: ['preview-42'] })).toEqual({
      enabled: true,
      environment: 'preview-42',
      reason: 'environment-allowed',
    })
    expect(integrationGate({ environments: ['production'] }).enabled).toBe(false)
  })

  it('folds the prod, stage and dev aliases on both sides', () => {
    runningAs('prod')
    expect(integrationGate({ environments: ['production'] }).environment).toBe('production')
    runningAs('production')
    expect(integrationGate({ environments: ['prod'] }).enabled).toBe(true)
    runningAs('stage')
    expect(integrationGate({ environments: ['staging'] }).enabled).toBe(true)
    runningAs('dev')
    expect(integrationGate({ environments: ['development'] }).enabled).toBe(true)
  })

  it('closes when nothing declares an environment, rather than assuming production', () => {
    runningAs(undefined)
    expect(integrationEnvironment()).toBeUndefined()
    expect(integrationGate({ environments: ['production'] })).toEqual({
      enabled: false,
      environment: undefined,
      reason: 'environment-unknown',
    })
    // Including when the allowlist would admit anything named.
    expect(integrationGate({ environments: ['production', 'staging', 'local'] }).enabled).toBe(false)
  })

  it('closes on an unreadable environment value', () => {
    // An encrypted or malformed `APP_ENV` is not a label, so it cannot match.
    for (const value of ['', '   ', 'encrypted:AAAA/BBBB', 'two words']) {
      process.env.APP_ENV = value
      delete process.env.NODE_ENV
      expect(integrationGate({ environments: ['production'] }).reason, value).toBe('environment-unknown')
    }
  })

  it('treats an empty allowlist as off everywhere', () => {
    for (const name of ['production', 'staging', 'local']) {
      runningAs(name)
      expect(integrationGate({ environments: [] }), name).toEqual({
        enabled: false,
        environment: name,
        reason: 'empty-allowlist',
      })
    }
  })

  it('lets enabled false win, and does not let enabled true bypass the allowlist', () => {
    runningAs('production')
    expect(integrationGate({ enabled: false })).toEqual({
      enabled: false,
      environment: 'production',
      reason: 'disabled-explicitly',
    })
    expect(integrationGate({ enabled: false, environments: ['production'] }).enabled).toBe(false)

    runningAs('local')
    // The trap this closes: `enabled: true` reads like "on", and on a laptop it
    // would mean "report into production".
    expect(integrationGate({ enabled: true })).toEqual({
      enabled: false,
      environment: 'local',
      reason: 'environment-excluded',
    })
    expect(integrationGate({ enabled: true, environments: ['local'] }).enabled).toBe(true)
  })

  it('hands back the effective environment for event metadata', () => {
    runningAs('prod')
    const gate = integrationGate({})
    expect(gate.enabled).toBe(true)
    // Normalized, so an adapter tags every event the same way whichever spelling
    // the deployment used, and the app never repeats `env.APP_ENV` itself.
    expect(gate.environment).toBe('production')
  })

  it('falls back to NODE_ENV when APP_ENV is absent', () => {
    delete process.env.APP_ENV
    process.env.NODE_ENV = 'production'
    expect(integrationEnvironment()).toBe('production')
    expect(integrationGate({}).enabled).toBe(true)
  })

  it('reads the environment at call time, not at import', () => {
    runningAs('local')
    expect(integrationGate({}).enabled).toBe(false)
    runningAs('production')
    expect(integrationGate({}).enabled).toBe(true)
  })

  it('accepts a caller default for integrations that are not remote telemetry', () => {
    runningAs('local')
    expect(integrationGate({}, ['local']).enabled).toBe(true)
    expect(REMOTE_TELEMETRY_ENVIRONMENTS).toEqual(['production', 'staging'])
  })

  it('normalizes only what it documents', () => {
    expect(normalizeEnvironmentName('PRODUCTION')).toBe('production')
    expect(normalizeEnvironmentName('  Staging  ')).toBe('staging')
    expect(normalizeEnvironmentName('prod')).toBe('production')
    expect(normalizeEnvironmentName('production-eu')).toBe('production-eu')
    expect(normalizeEnvironmentName('local')).toBe('local')
    expect(normalizeEnvironmentName(undefined)).toBeUndefined()
    expect(normalizeEnvironmentName(null)).toBeUndefined()
    expect(normalizeEnvironmentName('has space')).toBeUndefined()
    expect(normalizeEnvironmentName('semi;colon')).toBeUndefined()
  })
})
