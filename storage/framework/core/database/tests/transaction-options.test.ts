import { expect, test } from 'bun:test'
import { sqliteWriteOptions } from '../src/transaction-options'

test('writer options acquire SQLite ownership without passing unsupported provider options', () => {
  expect(sqliteWriteOptions('sqlite')).toEqual({ sqliteMode: 'immediate' })
  for (const dialect of ['postgres', 'mysql'] as const)
    expect(Object.hasOwn(sqliteWriteOptions(dialect), 'sqliteMode')).toBe(false)
})
