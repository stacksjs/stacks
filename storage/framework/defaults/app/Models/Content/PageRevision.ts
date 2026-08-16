import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A snapshot of a Page's document taken just before an overwrite - restoring
 * is copying the snapshot back and recording a new revision of what it
 * replaced. One row per save (the previous state), pruned to the newest N per
 * page (`config.cms.revisions.keep`).
 *
 * No `useApi`: revisions are read and restored through the CMS actions, never
 * CRUD'd directly.
 */
export default defineModel({
  name: 'PageRevision',
  table: 'page_revisions',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'page_revisions_page_revision_unique',
      columns: ['page_id', 'revision'],
      unique: true,
    },
  ],

  traits: {
    useTimestamps: true,
  },

  belongsTo: ['Page', 'Author'],

  attributes: {
    /** Monotonic per page, starting at 1. */
    revision: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
      factory: faker => faker.number.int({ min: 1, max: 20 }),
    },

    title: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.lorem.sentence(),
    },

    blocks: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.json(),
      },
      factory: () => JSON.stringify([]),
    },

    metaDescription: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().max(320),
      },
      factory: () => null,
    },

    /** Editor-supplied note ("reworded hero for spring"), optional. */
    note: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
      },
      factory: () => null,
    },
  },
} as const)
