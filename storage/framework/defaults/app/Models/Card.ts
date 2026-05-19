import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Kanban card (stacksjs/stacks#1846).
 *
 * A card belongs to a column (and, via denormalisation, to a board) so
 * board-wide queries don't need a two-hop join. Cards carry labels +
 * assignees via pivot tables (`card_labels`, `card_assignees`) — those
 * relations land in Phase 3 alongside the card-detail modal.
 *
 * Hidden from the sidebar as a standalone model row — cards are seen
 * through `/kanban/[boardId]` (Phase 2), not as a top-level model
 * viewer. The dashboard's modular config from #1843 carries that
 * `enabled: false` to both sidebars.
 */
export default defineModel({
  name: 'Card',
  table: 'cards',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'title', 'columnId', 'boardId', 'position', 'dueDate'],
      searchable: ['title', 'description'],
      sortable: ['position', 'createdAt', 'updatedAt', 'dueDate'],
      filterable: ['boardId', 'columnId', 'archived'],
    },

    useSeeder: { count: 0 },

    useApi: {
      uri: 'cards',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['BoardColumn', 'Board', 'User'],
  // Pivot relations land in Phase 3 (labels + assignees).
  // belongsToMany: {
  //   labels:    { model: 'Label', table: 'card_labels', foreignKey: 'card_id', relatedKey: 'label_id' },
  //   assignees: { model: 'User',  table: 'card_assignees', foreignKey: 'card_id', relatedKey: 'user_id' },
  // },

  attributes: {
    columnId: {
      order: 1,
      fillable: true,
      validation: { rule: schema.number().required() },
      factory: () => 1,
    },

    boardId: {
      order: 2,
      fillable: true,
      // Denormalised from `column.board_id` so a "all cards on board X"
      // query stays single-table. The kanban API keeps it in sync on
      // card create/move (Phase 2).
      validation: { rule: schema.number().required() },
      factory: () => 1,
    },

    title: {
      order: 3,
      fillable: true,
      validation: { rule: schema.string().required().min(1).max(300) },
      factory: faker => faker.lorem.sentence({ min: 3, max: 8 }),
    },

    description: {
      order: 4,
      fillable: true,
      // Markdown-formatted long description. Rendered in the card detail
      // modal (Phase 3); the kanban board view shows the first line only.
      validation: { rule: schema.string().max(10000) },
      factory: faker => faker.lorem.paragraph(),
    },

    position: {
      order: 5,
      fillable: true,
      // Sort order within the parent column. Drag-reorder reflows
      // adjacent rows in a single transaction (Phase 2). Moving across
      // columns updates both `columnId` and `position`.
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },

    createdByUserId: {
      order: 6,
      fillable: true,
      // The user who created the card. Set server-side from
      // `request.user.id` on store; surfaced in the card detail.
      validation: { rule: schema.number().nullable() },
      factory: () => null,
    },

    dueDate: {
      order: 7,
      fillable: true,
      validation: { rule: schema.string().nullable() },
      factory: () => null,
    },

    archived: {
      order: 8,
      fillable: true,
      validation: { rule: schema.boolean() },
      factory: () => false,
    },
  },

  dashboard: { enabled: false },
} as const)
