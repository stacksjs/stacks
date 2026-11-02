import { expect, test } from 'bun:test'
import { readCommittedTransactionOptions, sqliteWriteOptions } from '../src/transaction-options'

test('writer options acquire SQLite ownership without passing unsupported provider options', () => {
  expect(sqliteWriteOptions('sqlite')).toEqual({ sqliteMode: 'immediate' })
  for (const dialect of ['postgres', 'mysql'] as const)
    expect(Object.hasOwn(sqliteWriteOptions(dialect), 'sqliteMode')).toBe(false)
})

test('lock-serialized operations request fresh PostgreSQL snapshots and provider-safe write admission', () => {
  expect(readCommittedTransactionOptions('postgres')).toEqual({ isolation: 'read committed' })
  expect(readCommittedTransactionOptions('sqlite')).toEqual({ isolation: 'serializable', sqliteMode: 'immediate' })
  expect(readCommittedTransactionOptions('mysql')).toEqual({ isolation: undefined })
})
