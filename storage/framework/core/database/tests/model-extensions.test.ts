import { describe, expect, test } from 'bun:test'
import { databaseExtensionStatements } from '../src/model-extensions'

describe('model-owned database extension prerequisites', () => {
  test('PostgreSQL emits the reviewed prerequisite once, including wrapped ORM models', () => {
    const wrapped = Object.assign(() => {}, { [Symbol.for('stacks.orm.modelDefinition')]: { databaseExtensions: ['vector'] } })
    expect(databaseExtensionStatements([{ databaseExtensions: ['vector'] }, wrapped], 'postgres')).toEqual(['CREATE EXTENSION IF NOT EXISTS vector'])
  })
  test('portable SQLite and MySQL models never receive Postgres extension SQL', () => {
    expect(databaseExtensionStatements([{ databaseExtensions: ['vector'] }], 'sqlite')).toEqual([])
    expect(databaseExtensionStatements([{ databaseExtensions: ['vector'] }], 'mysql')).toEqual([])
    expect(databaseExtensionStatements([{}], 'postgres')).toEqual([])
  })
  test('unknown names and malformed declarations fail before SQL is emitted', () => {
    expect(() => databaseExtensionStatements([{ databaseExtensions: ['vector; DROP TABLE users'] }], 'postgres')).toThrow('Unsupported')
    expect(() => databaseExtensionStatements([{ databaseExtensions: 'vector' }], 'postgres')).toThrow('array')
  })
})
