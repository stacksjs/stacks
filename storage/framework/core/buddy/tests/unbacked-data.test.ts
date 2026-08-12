/**
 * `managedServices: { postgres: true }` puts the only copy of an app's data on
 * the same disk as the web process, and nothing backs it up
 * (stacksjs/stacks#2313). These pin what gets reported, and - just as
 * importantly - what does not: a warning that fires for a redis cache is a
 * warning people learn to scroll past, and the one it is hiding is the one
 * about the database.
 */

import { describe, expect, it } from 'bun:test'
import { findUnbackedManagedServices, unbackedDataMessage } from '../src/unbacked-data'

function config(managedServices: unknown): unknown {
  return { infrastructure: { compute: { managedServices } } }
}

describe('findUnbackedManagedServices', () => {
  it('reports the boolean form from the docs', () => {
    const found = findUnbackedManagedServices(config({ postgres: true }))

    expect(found.map(s => s.name)).toEqual(['postgres'])
  })

  it('reports a configured service, since a configuration means it is on', () => {
    // The shape apps actually ship: an object of settings, no `enabled` key.
    const found = findUnbackedManagedServices(config({
      vitess: { mode: 'cluster', cell: 'zone1', vtgatePort: 15306 },
    }))

    expect(found.map(s => s.name)).toEqual(['vitess'])
  })

  it('says nothing about caches and derived indexes', () => {
    // Losing these costs a rebuild, not the data. Warning about them is how a
    // warning stops being read.
    const found = findUnbackedManagedServices(config({
      redis: true,
      memcached: true,
      meilisearch: { masterKey: 'x' },
    }))

    expect(found).toEqual([])
  })

  it('reports every stateful engine, not just the first', () => {
    const found = findUnbackedManagedServices(config({ postgres: true, mysql: true, redis: true }))

    expect(found.map(s => s.name).sort()).toEqual(['mysql', 'postgres'])
  })

  it('honours an explicit opt-out', () => {
    expect(findUnbackedManagedServices(config({ postgres: { enabled: false } }))).toEqual([])
    expect(findUnbackedManagedServices(config({ postgres: false }))).toEqual([])
  })

  it('says nothing about a database this project did not provision', () => {
    // An app pointed at RDS, Neon or a managed Postgres has backups from its
    // provider and never wrote `managedServices` at all.
    expect(findUnbackedManagedServices(config(undefined))).toEqual([])
    expect(findUnbackedManagedServices({ infrastructure: { compute: {} } })).toEqual([])
    expect(findUnbackedManagedServices({})).toEqual([])
    expect(findUnbackedManagedServices(undefined)).toEqual([])
  })
})

describe('unbackedDataMessage', () => {
  it('names the service and what is about to run against it', () => {
    const message = unbackedDataMessage(findUnbackedManagedServices(config({ postgres: true })))

    expect(message).toContain('postgres is provisioned on the compute instance')
    expect(message).toContain('no dump, no snapshot, nothing offsite, and no restore path')
    // The asymmetry that makes this worth interrupting a deploy for.
    expect(message).toContain('`migrate`')
  })

  it('does not crash the command it was meant to warn during', () => {
    // Both callers check the list first, so this is unreachable today. It is
    // pinned anyway: a warning helper that throws takes down a deploy.
    expect(() => unbackedDataMessage([])).not.toThrow()
  })

  it('reads correctly for more than one service', () => {
    const message = unbackedDataMessage(findUnbackedManagedServices(config({ postgres: true, mysql: true })))

    expect(message).toContain('are provisioned')
    expect(message).toContain('backs them up')
  })
})
