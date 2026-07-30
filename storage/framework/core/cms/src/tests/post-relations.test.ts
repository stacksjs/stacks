import { beforeEach, describe, expect, test } from 'bun:test'
import { getDb } from '../database'
import { attach, detach, sync } from '../posts/store'
import { refreshDatabase } from './setup'

beforeEach(async () => {
  await refreshDatabase()
})

describe('post polymorphic relations', () => {
  test('attaches, synchronizes, and detaches categories by related id', async () => {
    const db = await getDb()

    await attach(42, 'categorizable_models', [3, 5])
    await sync(42, 'categorizable_models', [5, 7])

    expect(await db
      .selectFrom('categorizable_models')
      .select(['category_id', 'categorizable_id', 'categorizable_type'])
      .orderBy('category_id')
      .execute()).toEqual([
      { category_id: 5, categorizable_id: 42, categorizable_type: 'posts' },
      { category_id: 7, categorizable_id: 42, categorizable_type: 'posts' },
    ])

    await detach(42, 'categorizable_models', [5])

    expect(await db
      .selectFrom('categorizable_models')
      .select(['category_id'])
      .execute()).toEqual([{ category_id: 7 }])
  })

  test('writes the tag and owning post ids during sync', async () => {
    const db = await getDb()

    await sync(84, 'taggable_models', [2, 9])

    expect(await db
      .selectFrom('taggable_models')
      .select(['tag_id', 'taggable_id', 'taggable_type'])
      .orderBy('tag_id')
      .execute()).toEqual([
      { tag_id: 2, taggable_id: 84, taggable_type: 'posts' },
      { tag_id: 9, taggable_id: 84, taggable_type: 'posts' },
    ])
  })
})
