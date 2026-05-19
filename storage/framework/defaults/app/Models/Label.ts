import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Card label / tag (stacksjs/stacks#1846).
 *
 * Labels are board-scoped: each board owns its own label palette
 * (so "Bug" on board A is a different record from "Bug" on board B,
 * with potentially different colours). Cards attach labels via the
 * `card_labels` pivot — that wiring lands in Phase 3.
 *
 * Hidden from the sidebar as a standalone model row — labels are
 * managed inside the board view, not as a top-level surface.
 */
export default defineModel({
  name: 'Label',
  table: 'labels',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'color', 'boardId'],
      searchable: ['name'],
      sortable: ['name', 'createdAt'],
      filterable: ['boardId'],
    },

    useSeeder: { count: 0 },

    useApi: {
      uri: 'labels',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Board'],

  attributes: {
    boardId: {
      order: 1,
      fillable: true,
      validation: { rule: schema.number().required() },
      factory: () => 1,
    },

    name: {
      order: 2,
      fillable: true,
      validation: { rule: schema.string().required().min(1).max(60) },
      factory: faker => faker.helpers.arrayElement(['Bug', 'Feature', 'Docs', 'Refactor', 'Urgent']),
    },

    color: {
      order: 3,
      fillable: true,
      // Hue token resolved by the UI — same palette as Board.color.
      validation: { rule: schema.string().max(40) },
      factory: faker => faker.helpers.arrayElement(['red', 'amber', 'emerald', 'blue', 'violet', 'slate']),
    },
  },

  dashboard: { enabled: false },
} as const)
