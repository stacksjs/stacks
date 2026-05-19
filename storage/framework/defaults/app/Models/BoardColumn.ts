import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Column on a kanban board (stacksjs/stacks#1846).
 *
 * Each board owns an ordered list of columns ("Todo", "In Progress",
 * "Review", "Done", …). Cards live inside columns. Column ordering
 * within a board is driven by the `position` integer — Phase 2's drag
 * handler reorders by setting a new `position` and reflowing siblings.
 *
 * Hidden from the sidebar as a standalone model row (`dashboard.enabled:
 * false`) because columns only make sense inside a board. The dashboard
 * surfaces them indirectly through `/kanban/[boardId]`. Direct ORM
 * viewer access via `/models/board-column` still works for ops.
 */
export default defineModel({
  name: 'BoardColumn',
  table: 'board_columns',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'boardId', 'position'],
      searchable: ['name'],
      sortable: ['position', 'createdAt'],
      filterable: ['boardId'],
    },

    useSeeder: { count: 0 },

    useApi: {
      uri: 'board-columns',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Board'],
  hasMany: ['Card'],

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
      validation: { rule: schema.string().required().min(1).max(80) },
      factory: faker => faker.helpers.arrayElement(['Todo', 'In Progress', 'Review', 'Done']),
    },

    position: {
      order: 3,
      fillable: true,
      // Sort order within the parent board. Drag-reorder rewrites
      // adjacent rows in a single transaction (Phase 2).
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 10 }),
    },

    cardLimit: {
      order: 4,
      fillable: true,
      // WIP limit — nullable. The UI shows a warning badge when a
      // column hits its limit but doesn't reject new cards
      // (Phase 2/3 will decide whether the limit is hard or soft).
      validation: { rule: schema.number().min(0) },
      factory: () => null,
    },

    color: {
      order: 5,
      fillable: true,
      validation: { rule: schema.string().max(40) },
      factory: faker => faker.helpers.arrayElement(['slate', 'amber', 'blue', 'emerald']),
    },
  },

  dashboard: { enabled: false },
} as const)
