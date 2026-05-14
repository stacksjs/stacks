/**
 * Coverage for `getRelations` polymorphic + hasManyThrough wiring. Audit
 * top-12 #6 (`query-builder.md`):
 *
 *   `morphTo`, `morphMany`, `morphToMany`, `morphedByMany`, and
 *   `hasManyThrough` were declared in `ModelOptions` but `getRelations()`
 *   only processed `hasOne | hasMany | belongsTo | hasOneThrough |
 *   belongsToMany | morphOne` — declaring any of the missing five
 *   silently no-op'd at runtime.
 *
 * The fix routes `morphMany` through the same processor as `morphOne`,
 * adds `processMorphTo` for the inverse pole, and adds
 * `processPolymorphicPivot` for `morphToMany` / `morphedByMany`. This
 * test exercises each branch and asserts the produced RelationConfig
 * shape — separately from any DB-level eager-load test.
 */
import { describe, expect, it } from 'bun:test'
import { getRelations } from '../src/utils'

// We can't easily exercise getRelations against in-memory model
// fixtures because `loadModels` reads from disk. The tests here use
// shapes that don't trigger `loadModels` (morphTo, morphToMany,
// morphedByMany — all of which have processors that don't call
// loadModels) so we get coverage of the new branches in isolation.

describe('getRelations — polymorphic wiring (#6 audit fix)', () => {
  it('processes morphTo declarations into a runtime-resolvable RelationConfig', async () => {
    const result = await getRelations(
      {
        name: 'Comment',
        table: 'comments' as any,
        morphTo: { name: 'commentable' } as any,
      },
      'Comment',
    )
    // Pre-fix this returned an empty array — `morphTo` was silently dropped.
    expect(result.length).toBe(1)
    const r = result[0]
    expect(r.relationship).toBe('morphTo')
    // morphTo's target is resolved at runtime from <morph>_type, so
    // `model` / `table` are intentionally left blank in the static config.
    expect(r.model).toBe('')
    expect(r.foreignKey).toBe('commentable_id')
    expect(r.modelKey).toBe('commentable_type')
    expect(r.relationName).toBe('commentable')
  })

  it('uses the configured morph name when supplied', async () => {
    const result = await getRelations(
      {
        name: 'Comment',
        table: 'comments' as any,
        morphTo: { name: 'parent', type: 'parent_type', id: 'parent_id' } as any,
      },
      'Comment',
    )
    expect(result[0].relationName).toBe('parent')
    expect(result[0].foreignKey).toBe('parent_id')
    expect(result[0].modelKey).toBe('parent_type')
  })

  it('processes morphToMany into a polymorphic-pivot RelationConfig', async () => {
    const result = await getRelations(
      {
        name: 'Post',
        table: 'posts' as any,
        morphToMany: [{ model: 'Tag', morphName: 'taggable' }] as any,
      },
      'Post',
    )
    expect(result.length).toBe(1)
    const r = result[0]
    expect(r.relationship).toBe('morphToMany')
    expect(r.model).toBe('Tag')
    expect(r.pivotTable).toBe('taggable')
    expect(r.pivotForeign).toBe('taggable_id')
    expect(r.pivotKey).toBe('taggable_type')
  })

  it('processes morphedByMany (the inverse) the same way', async () => {
    const result = await getRelations(
      {
        name: 'Tag',
        table: 'tags' as any,
        morphedByMany: [{ model: 'Post', morphName: 'taggable' }] as any,
      },
      'Tag',
    )
    expect(result.length).toBe(1)
    const r = result[0]
    expect(r.relationship).toBe('morphedByMany')
    expect(r.model).toBe('Post')
    expect(r.pivotTable).toBe('taggable')
  })

  it('honors a custom pivotTable on polymorphic pivot declarations', async () => {
    const result = await getRelations(
      {
        name: 'Post',
        table: 'posts' as any,
        morphToMany: [{ model: 'Tag', morphName: 'taggable', pivotTable: 'post_tags' }] as any,
      },
      'Post',
    )
    expect(result[0].pivotTable).toBe('post_tags')
  })

  it('returns an empty array when no relations are declared', async () => {
    const result = await getRelations(
      { name: 'Plain', table: 'plains' as any },
      'Plain',
    )
    expect(result).toEqual([])
  })
})
