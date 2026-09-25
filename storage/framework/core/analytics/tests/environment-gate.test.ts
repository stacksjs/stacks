/**
 * Analytics honours the shared environment allowlist (stacksjs/stacks#2792).
 *
 * The thing being pinned is that exclusion happens *before* a driver is
 * resolved, so an excluded environment emits no tag at all. A label on an event
 * that still leaves the machine is the bug this option exists to close: a
 * laptop and a CI run reporting into the same project as production, where a
 * local startup failure reads as a live incident.
 *
 * `APP_ENV` and `NODE_ENV` are both set and restored around every case, because
 * `bun test` sets `NODE_ENV=test` itself - clearing only `APP_ENV` leaves the
 * gate reading `test` and tests something other than what it says.
 */

import type { AnalyticsConfig } from '@stacksjs/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { generateAnalyticsScript, getAnalyticsHead } from '../src/registry'

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

function runningAs(name: string): void {
  process.env.APP_ENV = name
}

/** A configured driver, so anything empty is the gate and not a missing key. */
const configured: AnalyticsConfig = {
  driver: 'fathom',
  drivers: { fathom: { siteId: 'ABCDEFGH' } },
}

describe('analytics environment gate', () => {
  it('renders nothing in an excluded environment, and the script with it', () => {
    runningAs('local')
    const config = { ...configured, environments: ['production', 'staging'] }

    expect(getAnalyticsHead(config)).toEqual([])
    // The rendered form too: a caller that only ever looks at the HTML must not
    // be handed a tag the head-tag list says is absent.
    expect(generateAnalyticsScript(config)).toBe('')
  })

  it('renders the driver in an allowed environment', () => {
    runningAs('production')
    const tags = getAnalyticsHead({ ...configured, environments: ['production', 'staging'] })

    expect(tags.length).toBeGreaterThan(0)
    expect(generateAnalyticsScript({ ...configured, environments: ['production'] })).toContain('ABCDEFGH')
  })

  it('leaves an installation that never set the option exactly as it was', () => {
    // The compatibility promise: reporting does not change because this check
    // exists. Without `environments`, every environment still reports.
    for (const name of ['local', 'development', 'test', 'production']) {
      runningAs(name)
      expect(getAnalyticsHead(configured).length, name).toBeGreaterThan(0)
    }
  })

  it('lets enabled false win, and does not let enabled true bypass the allowlist', () => {
    runningAs('production')
    expect(getAnalyticsHead({ ...configured, enabled: false })).toEqual([])

    runningAs('local')
    expect(getAnalyticsHead({ ...configured, enabled: true, environments: ['production'] })).toEqual([])
    expect(getAnalyticsHead({ ...configured, enabled: true, environments: ['local'] }).length).toBeGreaterThan(0)
  })

  it('treats an empty allowlist as off everywhere', () => {
    for (const name of ['production', 'local']) {
      runningAs(name)
      expect(getAnalyticsHead({ ...configured, environments: [] }), name).toEqual([])
    }
  })

  it('closes before a driver is resolved, so exclusion needs no credentials', () => {
    // A configured driver with its key missing throws when it is reached. An
    // excluded environment must not reach it, which is what proves the gate
    // runs first rather than filtering tags afterwards.
    runningAs('local')
    const unconfigured: AnalyticsConfig = { driver: 'fathom', drivers: {}, environments: ['production'] }

    expect(getAnalyticsHead(unconfigured)).toEqual([])
    runningAs('production')
    expect(() => getAnalyticsHead(unconfigured)).toThrow()
  })
})
