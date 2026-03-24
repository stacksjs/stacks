import { describe, expect, mock, test } from 'bun:test'

// Mock the bun-query-builder dependency
mock.module('bun-query-builder', () => ({
  createQueryBuilder: () => ({
    select: () => ({}),
    from: () => ({}),
  }),
  QueryBuilder: class {},
  SqliteDialect: class {},
  MysqlDialect: class {},
  PostgresDialect: class {},
}))

describe('query-builder module', () => {
  test('module re-exports from bun-query-builder', async () => {
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
  })

  test('QueryBuilder alias is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.QueryBuilder).toBeDefined()
    expect(typeof mod.QueryBuilder).toBe('function')
  })

  test('createQueryBuilder is exported via re-export', async () => {
    const mod = await import('../src/index')
    expect(mod.createQueryBuilder).toBeDefined()
    expect(typeof mod.createQueryBuilder).toBe('function')
  })

  test('QueryBuilder and createQueryBuilder reference the same function', async () => {
    const mod = await import('../src/index')
    expect(mod.QueryBuilder).toBe(mod.createQueryBuilder)
  })
})
