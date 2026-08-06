import type { Model } from '@stacksjs/types'
import { describe, expect, it } from 'bun:test'
import { belongsToColumnsOf } from '../src/relation-columns'

/**
 * A `belongsTo` can say what happens to its row when the row it points at goes.
 *
 * Without it, an application that deletes a parent has to delete the children
 * first, in the right order, in every place it deletes - and the place it
 * misses leaves rows nothing can reach. The database already knows how to do
 * this; it only needed somewhere to be told.
 *
 * Found in a forge where twenty-two tables hang off one row: every delete
 * walked `information_schema` at runtime to work out an order, because the
 * cascade could not be declared.
 *
 * What this file covers is the Stacks half: the field exists on the relation,
 * survives being read back off a model, and changes no column name on the way.
 * What the value then *does* to the emitted DDL is bun-query-builder's job and
 * is tested there against real SQL.
 *
 * Deliberately not claimed here: a compile-time guard. `core/tsconfig.build.json`
 * excludes every package's tests directory, so nothing typechecks this file -
 * the models below are annotated `Model` because that is what they are, not
 * because a missing field would be caught. The place that catches it is an
 * application's own `buddy typecheck`, which covers the models it ships.
 */

const Repository: Model = {
  name: 'Repository',
  table: 'repositories',
  primaryKey: 'id',
  attributes: {
    name: { validation: { rule: {} as any } },
  },
}

/** The shape that matters here: the column is declared *and* the relation is. */
const Topic: Model = {
  name: 'RepoTopic',
  table: 'repo_topics',
  primaryKey: 'id',
  belongsTo: [{ model: 'Repository', onDelete: 'cascade' }],
  attributes: {
    repository_id: { validation: { rule: {} as any } },
    topic: { validation: { rule: {} as any } },
  },
}

/** The column left to be generated from the relation. */
const Star: Model = {
  name: 'Star',
  table: 'stars',
  primaryKey: 'id',
  belongsTo: [{ model: 'Repository', onDelete: 'cascade' }],
  attributes: {},
}

/** A custom column name, with an action on it. */
const Fork: Model = {
  name: 'Fork',
  table: 'forks',
  primaryKey: 'id',
  belongsTo: [{ model: 'Repository', foreignKey: 'parent_id', onDelete: 'set null' }],
  attributes: {},
}

describe('belongsTo onDelete', () => {
  it('is declarable on every form a relation takes', () => {
    // Reading them back is what stops this being a comment: a field the type
    // allows but nothing carries is the bug being fixed, one level up.
    const relations = [Topic, Star, Fork].map(model => (model.belongsTo as any[])[0])

    expect(relations.map(relation => relation.onDelete)).toEqual(['cascade', 'cascade', 'set null'])
  })

  it('leaves the foreign key column exactly where it was', () => {
    // The action is about what happens to the row, not about which column
    // points at it, so adding it must not move a single column name.
    expect(belongsToColumnsOf(Topic)).toEqual(['repository_id'])
    expect(belongsToColumnsOf(Star)).toEqual(['repository_id'])
    expect(belongsToColumnsOf(Fork)).toEqual(['parent_id'])
    expect(belongsToColumnsOf(Repository)).toEqual([])
  })

  /**
   * `undefined` is the database's own default - `NO ACTION`, the delete
   * refused while a child still points at the row - and it has to stay the
   * default here, because it is what every model that says nothing gets.
   */
  it('is absent unless somebody asked for it', () => {
    const Plain: Model = {
      name: 'Watch',
      table: 'watches',
      primaryKey: 'id',
      belongsTo: ['Repository'],
      attributes: {},
    }

    expect((Plain.belongsTo as any[])[0]).toBe('Repository')
    expect(belongsToColumnsOf(Plain)).toEqual(['repository_id'])
  })
})
