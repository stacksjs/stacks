// The tag aggregates, and which table the pivot points at (stacksjs/stacks#2579).
//
// `taggable_models.tag_id` is a `tags` id. Four queries in this module joined it
// to `taggables` instead - a real table, but belonging to a different mechanism:
// the `taggable` trait writes tag names straight into it with no pivot row at
// all. The join returned nothing, silently, and no test noticed because the
// harness did not create a `tags` table for them to be wrong about.
//
// The counts were the second bug in the same four functions: none of them
// selected an aggregate, then each read a field that was never in the result, so
// every count was 0 and "most used" was whichever tag sorted first by name.

import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { refreshDatabase } from './setup'
import {
  fetchTagDistribution,
  fetchTagsWithPostCounts,
  findLeastUsedTag,
  findMostUsedTag,
} from '../taggables'

beforeEach(async () => {
  await refreshDatabase()
})

/** A `tags` row, returning its id. */
async function tag(name: string): Promise<number> {
  await db.insertInto('tags').values({ name, slug: name.toLowerCase() }).execute()
  const row = await db.selectFrom('tags').select(['id']).where('name', '=', name).executeTakeFirst() as { id: number }
  return row.id
}

/** Attach `tagId` to a post, the way `syncPostRelations` does. */
async function attach(tagId: number, postId: number, type = 'posts'): Promise<void> {
  await db.insertInto('taggable_models').values({
    tag_id: tagId,
    taggable_id: postId,
    taggable_type: type,
  }).execute()
}

describe('findMostUsedTag', () => {
  it('finds the tag with the most attachments, not the first by name', async () => {
    // `zebra` sorts last and is used most; `alpha` sorts first and is used once.
    // Ordering by name answered `alpha`, which is the bug.
    const alpha = await tag('alpha')
    const zebra = await tag('zebra')
    await attach(alpha, 1)
    await attach(zebra, 1)
    await attach(zebra, 2)
    await attach(zebra, 3)

    expect(await findMostUsedTag()).toEqual({ name: 'zebra', count: 3 })
  })

  it('reports a real count rather than zero', async () => {
    // Every one of these read a field the query never selected.
    const only = await tag('only')
    await attach(only, 1)
    await attach(only, 2)

    expect((await findMostUsedTag())?.count).toBe(2)
  })

  it('filters by taggable type', async () => {
    const shared = await tag('shared')
    await attach(shared, 1, 'posts')
    await attach(shared, 7, 'storage_items')
    await attach(shared, 8, 'storage_items')

    expect(await findMostUsedTag('posts')).toEqual({ name: 'shared', count: 1 })
    expect(await findMostUsedTag('storage_items')).toEqual({ name: 'shared', count: 2 })
  })

  it('answers null when nothing is tagged', async () => {
    await tag('unused')
    expect(await findMostUsedTag()).toBeNull()
  })
})

describe('findLeastUsedTag', () => {
  it('finds the tag with the fewest attachments', async () => {
    const rare = await tag('rare')
    const common = await tag('common')
    await attach(rare, 1)
    await attach(common, 1)
    await attach(common, 2)

    expect(await findLeastUsedTag()).toEqual({ name: 'rare', count: 1 })
  })
})

describe('fetchTagsWithPostCounts', () => {
  it('counts attachments per tag, most used first', async () => {
    const used = await tag('used')
    const once = await tag('once')
    await tag('never')
    await attach(used, 1)
    await attach(used, 2)
    await attach(once, 1)

    const counts = await fetchTagsWithPostCounts()
    expect(counts.slice(0, 2)).toEqual([
      { name: 'used', postCount: 2 },
      { name: 'once', postCount: 1 },
    ])
  })

  it('includes a tag nothing is attached to, with a count of zero', async () => {
    // A left join, so an unused tag is still a tag. Worth pinning: an inner
    // join here would silently hide the vocabulary from a tag manager.
    await tag('orphan')
    expect(await fetchTagsWithPostCounts()).toEqual([{ name: 'orphan', postCount: 0 }])
  })
})

describe('fetchTagDistribution', () => {
  it('reports counts and percentages that add up', async () => {
    // The total was computed from counts that were all zero, so every
    // percentage was zero and the donut had no segments.
    const a = await tag('a')
    const b = await tag('b')
    await attach(a, 1)
    await attach(a, 2)
    await attach(a, 3)
    await attach(b, 1)

    const distribution = await fetchTagDistribution()
    expect(distribution).toEqual([
      { name: 'a', count: 3, percentage: 75 },
      { name: 'b', count: 1, percentage: 25 },
    ])
  })

  it('does not divide by zero when nothing is tagged', async () => {
    await tag('unused')
    expect(await fetchTagDistribution()).toEqual([{ name: 'unused', count: 0, percentage: 0 }])
  })
})

describe('the pivot points at tags, not taggables', () => {
  it('ignores a taggables row that shares an id with a tag', async () => {
    // The failure mode that made this worth a test rather than a comment: the
    // old join did not error, it returned a DIFFERENT vocabulary's row when the
    // ids happened to line up.
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS taggables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255),
        slug VARCHAR(255),
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        taggable_type VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `).execute()
    await db.unsafe('DELETE FROM taggables').execute()
    await db.insertInto('taggables').values({
      name: 'wrong-vocabulary',
      slug: 'wrong-vocabulary',
      taggable_type: 'posts',
      is_active: true,
    }).execute()

    const right = await tag('right-vocabulary')
    await attach(right, 1)

    expect(await findMostUsedTag()).toEqual({ name: 'right-vocabulary', count: 1 })
  })
})
