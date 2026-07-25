import { describe, expect, it } from 'bun:test'
import {
  foreignTenantKeys,
  partitionTenantEnv,
  stripForeignTenantEnv,
  tenantEnvPrefix,
} from '../src/tenants'

/**
 * A shared box hosts several projects: one owns it, the rest attach with
 * `cloud.attachTo`. Each brings its own `.env.<environment>`, so no project
 * needs another's secrets - but they leak into the owner's file anyway, under a
 * `TENANT_` prefix.
 *
 * That matters because `buddy deploy` ships the whole env file as each site's
 * `.env`, so a stray `BUGHQ_STRIPE_SECRET_KEY` in the owner's file lands on
 * disk in an unrelated site. These tests pin the classification that keeps them
 * out, and - just as importantly - that nothing is classified as foreign
 * without an explicit declaration.
 */

describe('tenantEnvPrefix', () => {
  it('upper-cases the slug and appends an underscore', () => {
    expect(tenantEnvPrefix('bughq')).toBe('BUGHQ_')
  })

  it('strips separators so hyphen and underscore slugs agree', () => {
    expect(tenantEnvPrefix('analytics-hq')).toBe('ANALYTICSHQ_')
    expect(tenantEnvPrefix('analytics_hq')).toBe('ANALYTICSHQ_')
    expect(tenantEnvPrefix('Analytics HQ')).toBe('ANALYTICSHQ_')
  })
})

describe('partitionTenantEnv', () => {
  const values = {
    APP_KEY: 'own',
    DB_PASSWORD: 'own',
    STRIPE_SECRET_KEY: 'own',
    BUGHQ_APP_KEY: 'theirs',
    BUGHQ_STRIPE_SECRET_KEY: 'theirs',
    ANALYTICSHQ_DB_PASSWORD: 'theirs',
  }

  it('keeps everything when no tenants are declared', () => {
    const partition = partitionTenantEnv(values)

    expect(partition.own).toEqual(values)
    expect(partition.foreign).toEqual({})
  })

  it('splits declared tenants out of the own set', () => {
    const partition = partitionTenantEnv(values, { self: 'stacks', tenants: ['bughq', 'analyticshq'] })

    expect(Object.keys(partition.own).sort()).toEqual(['APP_KEY', 'DB_PASSWORD', 'STRIPE_SECRET_KEY'])
    expect(partition.foreign.bughq).toEqual({
      BUGHQ_APP_KEY: 'theirs',
      BUGHQ_STRIPE_SECRET_KEY: 'theirs',
    })
    expect(partition.foreign.analyticshq).toEqual({ ANALYTICSHQ_DB_PASSWORD: 'theirs' })
  })

  it('never treats a vendor prefix as a tenant', () => {
    // The whole point of requiring a declaration: these are indistinguishable
    // from a slug prefix by shape alone.
    const partition = partitionTenantEnv(
      { STRIPE_SECRET_KEY: 'k', AWS_REGION: 'us-east-1', MEILISEARCH_KEY: 'k' },
      { self: 'stacks', tenants: ['bughq'] },
    )

    expect(Object.keys(partition.own).sort()).toEqual(['AWS_REGION', 'MEILISEARCH_KEY', 'STRIPE_SECRET_KEY'])
    expect(partition.foreign).toEqual({})
  })

  it('keeps the project its own slug-prefixed keys', () => {
    const partition = partitionTenantEnv(
      { STACKS_API_TOKEN: 'mine', BUGHQ_API_TOKEN: 'theirs' },
      { self: 'stacks', tenants: ['stacks', 'bughq'] },
    )

    expect(partition.own).toEqual({ STACKS_API_TOKEN: 'mine' })
    expect(partition.foreign.bughq).toEqual({ BUGHQ_API_TOKEN: 'theirs' })
    expect(partition.foreign.stacks).toBeUndefined()
  })

  it('matches slug spellings that differ only by separator', () => {
    const partition = partitionTenantEnv(
      { ANALYTICSHQ_DB_PASSWORD: 'theirs' },
      { tenants: ['analytics-hq'] },
    )

    expect(partition.own).toEqual({})
    expect(partition.foreign['analytics-hq']).toEqual({ ANALYTICSHQ_DB_PASSWORD: 'theirs' })
  })

  it('gives the longest matching prefix the key', () => {
    const partition = partitionTenantEnv(
      { ANALYTICSHQ_DB_PASSWORD: 'theirs' },
      { tenants: ['analytics', 'analyticshq'] },
    )

    expect(partition.foreign.analyticshq).toEqual({ ANALYTICSHQ_DB_PASSWORD: 'theirs' })
    expect(partition.foreign.analytics).toBeUndefined()
  })

  it('requires the underscore, so a shared word prefix is not a match', () => {
    const partition = partitionTenantEnv({ BUGHQAPP_KEY: 'own' }, { tenants: ['bughq'] })

    expect(partition.own).toEqual({ BUGHQAPP_KEY: 'own' })
  })

  it('ignores empty and non-string tenant entries', () => {
    const partition = partitionTenantEnv(
      { APP_KEY: 'own', BUGHQ_APP_KEY: 'theirs' },
      { tenants: ['', '   ', undefined as unknown as string, 'bughq'] },
    )

    expect(partition.own).toEqual({ APP_KEY: 'own' })
    expect(partition.foreign.bughq).toEqual({ BUGHQ_APP_KEY: 'theirs' })
  })

  it('leaves the input untouched', () => {
    const input = { APP_KEY: 'own', BUGHQ_APP_KEY: 'theirs' }
    partitionTenantEnv(input, { tenants: ['bughq'] })

    expect(input).toEqual({ APP_KEY: 'own', BUGHQ_APP_KEY: 'theirs' })
  })
})

describe('stripForeignTenantEnv', () => {
  it('returns only what this project should ship', () => {
    const shipped = stripForeignTenantEnv(
      { APP_KEY: 'own', BUGHQ_STRIPE_SECRET_KEY: 'theirs' },
      { self: 'stacks', tenants: ['bughq'] },
    )

    expect(shipped).toEqual({ APP_KEY: 'own' })
  })

  it('is a no-op without declared tenants', () => {
    const values = { APP_KEY: 'own', BUGHQ_STRIPE_SECRET_KEY: 'theirs' }

    expect(stripForeignTenantEnv(values)).toEqual(values)
  })
})

describe('foreignTenantKeys', () => {
  it('reports each tenant once, sorted, with sorted keys', () => {
    const partition = partitionTenantEnv(
      {
        ZULU_KEY: 'own',
        BUGHQ_STRIPE_SECRET_KEY: 'theirs',
        BUGHQ_APP_KEY: 'theirs',
        ANALYTICSHQ_DB_PASSWORD: 'theirs',
      },
      { tenants: ['bughq', 'analyticshq'] },
    )

    expect(foreignTenantKeys(partition)).toEqual([
      { tenant: 'analyticshq', keys: ['ANALYTICSHQ_DB_PASSWORD'] },
      { tenant: 'bughq', keys: ['BUGHQ_APP_KEY', 'BUGHQ_STRIPE_SECRET_KEY'] },
    ])
  })

  it('is empty when nothing is foreign', () => {
    expect(foreignTenantKeys(partitionTenantEnv({ APP_KEY: 'own' }, { tenants: ['bughq'] }))).toEqual([])
  })
})
