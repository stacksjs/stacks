/**
 * Regression coverage for stacksjs/status#1 Phase 9's real e2e Hetzner
 * deploy verification: ts-cloud's `buildSiteDeployScript` treats a site's
 * `env` as the COMPLETE content of its deployed `.env` — it has no idea
 * `.env.production`/dotenvx encryption exist (ts-cloud is a generic deploy
 * tool). Confirmed against a live deploy: the `main` site (no `env`
 * override) came up logging "loaded 0 variables from .env", and `api`
 * (which only declares `{ HOST, APP_ENV }` to force the loopback bind) came
 * up with just those 2 keys and none of its real production config.
 *
 * `resolveDeployEnvValues` + `mergeSiteDeployEnv` close this gap: the
 * former decrypts the deploy-target's env file, the latter merges it
 * underneath each site's explicit overrides (stripping a general PORT when
 * the site has its own, since the systemd unit's `Environment=PORT=`
 * would otherwise get silently overridden by a stale file value once the
 * app's own dotenv loading applies file values unconditionally).
 */

import { describe, expect, it } from 'bun:test'
import { mergeSiteDeployEnv } from '../src/commands/deploy'

describe('mergeSiteDeployEnv', () => {
  it('merges the resolved deploy env underneath a site with no explicit env', () => {
    const sites = { main: { root: '.', start: 'bun serve', port: 3000 } }
    const resolved = { APP_NAME: 'UptimeStatus', DB_CONNECTION: 'sqlite', PORT: '3000' }

    const merged = mergeSiteDeployEnv(sites, resolved)

    expect(merged.main.env.APP_NAME).toBe('UptimeStatus')
    expect(merged.main.env.DB_CONNECTION).toBe('sqlite')
  })

  it("strips a general PORT when the site declares its own — the systemd unit's Environment=PORT is authoritative", () => {
    const sites = { api: { root: '.', start: 'bun api', port: 3008, env: { HOST: '127.0.0.1', APP_ENV: 'production' } } }
    const resolved = { APP_NAME: 'UptimeStatus', PORT: '3000' } // PORT here is main's port, not api's

    const merged = mergeSiteDeployEnv(sites, resolved)

    expect(merged.api.env.PORT).toBeUndefined()
    expect(merged.api.env.HOST).toBe('127.0.0.1')
    expect(merged.api.env.APP_ENV).toBe('production')
    expect(merged.api.env.APP_NAME).toBe('UptimeStatus')
  })

  it("a site's own explicit env always wins over the resolved deploy env for the same key", () => {
    const sites = { api: { root: '.', start: 'bun api', port: 3008, env: { APP_ENV: 'production' } } }
    const resolved = { APP_ENV: 'encrypted:garbage-if-decryption-ever-regresses' }

    const merged = mergeSiteDeployEnv(sites, resolved)

    expect(merged.api.env.APP_ENV).toBe('production')
  })

  it('keeps PORT from the resolved deploy env when a site has no port of its own (background worker/scheduler)', () => {
    const sites = { worker: { root: '.', start: 'bun buddy queue:work' } }
    const resolved = { APP_NAME: 'UptimeStatus', PORT: '3000' }

    const merged = mergeSiteDeployEnv(sites, resolved)

    // No port to conflict with — fine either way, but confirms PORT isn't
    // stripped just because *some* site in the map has one.
    expect(merged.worker.env.PORT).toBe('3000')
  })

  it('passes through a falsy/missing site untouched (bucket sites, sparse maps)', () => {
    const sites = { docs: null }
    const merged = mergeSiteDeployEnv(sites as any, { APP_NAME: 'UptimeStatus' })
    expect(merged.docs).toBeNull()
  })

  it('does not mutate the input sites object', () => {
    const sites = { main: { root: '.', start: 'bun serve', port: 3000 } }
    const before = JSON.stringify(sites)
    mergeSiteDeployEnv(sites, { APP_NAME: 'UptimeStatus' })
    expect(JSON.stringify(sites)).toBe(before)
  })
})
