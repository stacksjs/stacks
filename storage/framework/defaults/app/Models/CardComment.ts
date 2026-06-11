import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Card comment (stacksjs/stacks#1846 Phase 3).
 *
 * Each comment belongs to a card and (optionally) to the user who
 * wrote it. Anonymous comments are allowed via nullable `user_id` —
 * makes the dev dashboard usable on localhost without an auth round-
 * trip, and supports system-generated activity entries
 * (eventually — Phase 4 could write status-change comments here).
 *
 * Distinct from `Comment` (which is post-specific) so the schemas
 * don't fight: post comments carry `author_name`/`author_email` for
 * public commenters; card comments are internal-only and lean on
 * the `user_id` FK for attribution.
 */
export default defineModel({
  name: 'CardComment',
  table: 'card_comments',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'cardId', 'userId', 'body', 'createdAt'],
      searchable: ['body'],
      sortable: ['createdAt'],
      filterable: ['cardId'],
    },

    useSeeder: { count: 0 },

    useApi: {
      uri: 'card-comments',
      routes: ['index', 'store', 'show', 'destroy'],
    },
  },

  belongsTo: ['Card', 'User'],

  attributes: {
    cardId: {
      order: 1,
      fillable: true,
      validation: { rule: schema.number().required() },
      factory: () => 1,
    },

    userId: {
      order: 2,
      fillable: true,
      validation: { rule: schema.number() },
      factory: () => null,
    },

    body: {
      order: 3,
      fillable: true,
      validation: { rule: schema.string().required().min(1).max(10000) },
      factory: faker => faker.lorem.sentence(),
    },
  },

  dashboard: { enabled: false },
} as const)
