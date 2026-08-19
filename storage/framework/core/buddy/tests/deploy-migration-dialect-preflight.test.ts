/**
 * stacksjs/stacks#2347 - a deploy must not report success while shipping an app
 * that cannot read its own database.
 *
 * The scaffolded workflow runs the remote migrate step with
 * `|| echo "::warning::"`, so a wrong-dialect corpus fails there without failing
 * the job: TLS issued, DNS reconciled, site answering 200, and no tables. The
 * dialect is knowable locally before anything ships, so the deploy refuses
 * instead, alongside the API-reachability and port checks.
 *
 * These cover which sites and which connection get audited. The audit itself is
 * `validateMigrationDialect`, covered in the migrate suite.
 */

import { describe, expect, it } from 'bun:test'
import { siteDatabaseDrivers } from '../src/commands/deploy'

const migrating = (env: Record<string, string> = {}) => ({
  start: 'bun cli.js serve',
  preStart: ['bun cli.js migrate'],
  env,
})

describe('siteDatabaseDrivers', () => {
  it('reads the connection from the site, not the deploying shell', () => {
    expect(siteDatabaseDrivers({ main: migrating({ DB_CONNECTION: 'postgres' }) })).toEqual(['postgres'])
  })

  it('defaults to sqlite when the site names no connection', () => {
    // Matches validateMigrationDialect's own default, so the deploy audits the
    // corpus the box will actually run.
    expect(siteDatabaseDrivers({ main: migrating() })).toEqual(['sqlite'])
  })

  it('lowercases, so DB_CONNECTION=Postgres is not treated as a third database', () => {
    expect(siteDatabaseDrivers({ main: migrating({ DB_CONNECTION: 'Postgres' }) })).toEqual(['postgres'])
  })

  it('reports each distinct connection once', () => {
    const sites = {
      a: migrating({ DB_CONNECTION: 'sqlite' }),
      b: migrating({ DB_CONNECTION: 'sqlite' }),
      c: migrating({ DB_CONNECTION: 'postgres' }),
    }

    expect(siteDatabaseDrivers(sites).sort()).toEqual(['postgres', 'sqlite'])
  })

  it('ignores sites that never run migrations', () => {
    // Refusing a deploy over the database a static site never opens would be a
    // refusal with nothing to act on.
    const sites = {
      docs: { start: 'bun cli.js serve', preStart: ['bun run build'], env: { DB_CONNECTION: 'postgres' } },
      assets: { root: 'dist', env: { DB_CONNECTION: 'mysql' } },
    }

    expect(siteDatabaseDrivers(sites)).toEqual([])
  })

  it('recognises the migrate step whatever it is called', () => {
    for (const step of ['bun cli.js migrate', 'buddy db:migrate', 'bun cli.js migrate:fresh']) {
      const sites = { main: { start: 'bun cli.js serve', preStart: [step], env: { DB_CONNECTION: 'postgres' } } }
      expect(siteDatabaseDrivers(sites)).toEqual(['postgres'])
    }
  })

  it('is empty for a config with no sites at all', () => {
    expect(siteDatabaseDrivers({})).toEqual([])
  })
})
