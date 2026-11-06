import { describe, expect, test } from 'bun:test'
import { isUnmigratedTable } from './model-migration'

/**
 * The models pages answer "not migrated" instead of a 503 only when the
 * catalog says the table is missing. Anything less certain must keep the
 * original error, so a real outage is never relabelled as a migrate hint.
 */
describe('isUnmigratedTable', () => {
  test('a table the catalog does not have is unmigrated', async () => {
    expect(await isUnmigratedTable('menus', async () => false)).toBeTrue()
  })

  test('a table the catalog has is not, so its failure stays an error', async () => {
    expect(await isUnmigratedTable('users', async () => true)).toBeFalse()
  })

  test('a catalog check that fails too keeps the original error', async () => {
    expect(await isUnmigratedTable('users', async () => { throw new Error('connection refused') })).toBeFalse()
  })

  test('the table it asks about is the one it was given', async () => {
    const asked: string[] = []
    await isUnmigratedTable('usage_events', async (table) => { asked.push(table); return false })
    expect(asked).toEqual(['usage_events'])
  })
})
