import { afterAll, describe, expect, it } from 'bun:test'
import { createQueryBuilder, setConfig } from '@stacksjs/query-builder'
import { DatabaseFeatureFlagDriver } from '../src/drivers/database'
import { FeatureFlagStoreError } from '../src/errors'
import { featureFlagMigrationSql } from '../src/schema'

setConfig({ dialect: 'sqlite', database: { database: ':memory:' } } as any)
const database = createQueryBuilder() as any
const driver = new DatabaseFeatureFlagDriver(database, {
  table: 'test_feature_flags',
  dialect: 'sqlite',
  autoCreate: true,
})

afterAll(async () => {
  await database.unsafe('DROP TABLE IF EXISTS test_feature_flags').execute()
})

describe('DatabaseFeatureFlagDriver', () => {
  it('provisions package-owned SQLite schema only when configured', async () => {
    await driver.set('checkout', 'user:1', true)
    const rows = await database.unsafe("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'test_feature_flags'").execute()
    expect(rows).toEqual([{ name: 'test_feature_flags' }])
  })

  it('creates, updates, and reads JSON values', async () => {
    await driver.set('layout', 'user:1', { variant: 'compact', density: 2 })
    expect(await driver.get('layout', 'user:1')).toEqual({ variant: 'compact', density: 2 })

    await driver.set('layout', 'user:1', { variant: 'visual', density: 1 })
    expect(await driver.get('layout', 'user:1')).toEqual({ variant: 'visual', density: 1 })

    const rows = await database.unsafe("SELECT COUNT(*) AS count FROM test_feature_flags WHERE name = 'layout' AND scope = 'user:1'").execute()
    expect(Number(rows[0].count)).toBe(1)
  })

  it('preserves one row under concurrent first writes', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, index) => driver.set('race', 'global', index)))
    const rows = await database.unsafe("SELECT COUNT(*) AS count FROM test_feature_flags WHERE name = 'race' AND scope = 'global'").execute()
    expect(Number(rows[0].count)).toBe(1)
    expect(typeof await driver.get('race', 'global')).toBe('number')
  })

  it('lists and deletes scoped values', async () => {
    await driver.set('a', 'tenant:1', true)
    await driver.set('b', 'tenant:1', 'variant')
    await driver.set('a', 'tenant:2', false)
    expect(await driver.stored('tenant:1')).toEqual({ a: true, b: 'variant' })

    await driver.delete('a', 'tenant:1')
    expect(await driver.stored('tenant:1')).toEqual({ b: 'variant' })
    await driver.deleteForAllScopes(['a'])
    expect(await driver.get('a', 'tenant:2')).toBeUndefined()
  })

  it('clears the table without dropping package schema', async () => {
    await driver.clear()
    expect(await driver.stored('tenant:1')).toEqual({})
    await driver.set('after-clear', 'global', true)
    expect(await driver.get('after-clear', 'global')).toBe(true)
  })

  it('generates safe dialect-specific publishable SQL', () => {
    expect(featureFlagMigrationSql({ dialect: 'sqlite', table: 'flags' })).toHaveLength(2)
    expect(featureFlagMigrationSql({ dialect: 'postgres', table: 'flags' }).join(' ')).toContain('TIMESTAMPTZ')
    expect(featureFlagMigrationSql({ dialect: 'mysql', table: 'flags' })).toHaveLength(1)
    expect(() => featureFlagMigrationSql({ table: 'flags; DROP TABLE users' })).toThrow(FeatureFlagStoreError)
  })

  it('reports corrupt stored JSON with flag context', async () => {
    await database.unsafe("INSERT INTO test_feature_flags (name, scope, value) VALUES ('corrupt', 'global', '{bad')").execute()
    await expect(driver.get('corrupt', 'global')).rejects.toThrow(/corrupt/)
  })

  it('does not provision schema unless autoCreate is enabled', async () => {
    const manual = new DatabaseFeatureFlagDriver(database, { table: 'missing_flags' })
    await expect(manual.get('flag', 'global')).rejects.toThrow(/no such table/i)
  })
})
