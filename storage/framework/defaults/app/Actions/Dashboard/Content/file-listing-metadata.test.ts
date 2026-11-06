import { describe, expect, test } from 'bun:test'
import type { StorageMetadataStore } from './file-metadata'
import { createMemoryMetadataStore } from './file-metadata'
import { readListingMetadata } from './file-manager'

/**
 * The file listing reads the advisory metadata rows (stars, tags, tasks)
 * before building the tree. A missing table must give an empty answer, not a
 * failed listing (stacksjs/stacks#3211); anything else must still fail.
 */
function failingStore(error: Error): StorageMetadataStore {
  const store = createMemoryMetadataStore()
  return { ...store, under: async () => { throw error }, tasksUnder: async () => { throw error } }
}

describe('readListingMetadata', () => {
  test('reads the rows when the tables exist', async () => {
    const store = createMemoryMetadataStore()
    await store.write('public', 'a.txt', { favorite: true, tags: [] })
    const read = await readListingMetadata(store, 'public', async () => { throw new Error('the catalog must not be asked') })

    expect(read.migrated).toBeTrue()
    expect(read.records.get('a.txt')?.favorite).toBeTrue()
  })

  test('a missing table lists with no stars, tags or tasks', async () => {
    const asked: string[] = []
    const read = await readListingMetadata(failingStore(new Error('relation "storage_items" does not exist')), 'public', async (table) => {
      asked.push(table)
      return table === 'storage_items'
    })

    expect(read).toEqual({ records: new Map(), tasks: new Map(), migrated: false })
    expect(asked).toEqual(['storage_items'])
  })

  test('the tasks table missing on its own counts too', async () => {
    const read = await readListingMetadata(failingStore(new Error('no such table: storage_item_tasks')), 'public', async table => table === 'storage_item_tasks')
    expect(read.migrated).toBeFalse()
  })

  test('any other failure still fails the listing', async () => {
    const outage = new Error('connection refused')
    await expect(readListingMetadata(failingStore(outage), 'public', async () => false)).rejects.toBe(outage)
  })
})
