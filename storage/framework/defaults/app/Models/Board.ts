import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Kanban board (stacksjs/stacks#1846).
 *
 * A board owns columns, columns own cards, cards carry labels +
 * assignees. The full hierarchy is exposed under the dashboard's
 * Management section as a dev-mode surface — admins and devs see
 * project-management boards; clients don't.
 *
 * Phase 1 scope: this model + read-only API + an index page listing
 * boards. Phase 2 adds the drag-and-drop kanban view + write API.
 */
export default defineModel({
  name: 'Board',
  table: 'boards',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'createdAt'],
      searchable: ['name', 'description'],
      sortable: ['name', 'createdAt', 'updatedAt', 'position'],
      filterable: ['archived'],
    },

    useSeeder: { count: 0 },

    useApi: {
      uri: 'boards',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  hasMany: ['BoardColumn', 'Label'],

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().min(1).max(120),
      },
      factory: faker => faker.commerce.productName(),
    },

    description: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(2000),
      },
      factory: faker => faker.lorem.sentence(),
    },

    icon: {
      order: 3,
      fillable: true,
      // SF Symbol name for the native sidebar; web sidebar falls back to a generic table icon.
      validation: { rule: schema.string().max(80) },
      factory: () => 'rectangle.stack.fill',
    },

    color: {
      order: 4,
      fillable: true,
      // Tailwind-style hue token: stx-blue, stx-violet, etc. Free-form
      // string; the UI maps unknown values to the default theme.
      validation: { rule: schema.string().max(40) },
      factory: faker => faker.helpers.arrayElement(['violet', 'blue', 'emerald', 'amber', 'rose']),
    },

    position: {
      order: 5,
      fillable: true,
      // Sort order in the "Boards" index. Lower = appears first.
      // Reflowed in bulk on reorder; defaults to "append at end" via
      // server-side max() + 1 on create.
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },

    archived: {
      order: 6,
      fillable: true,
      // Soft-archived boards stay in the DB but drop out of the
      // dashboard's default list view. They're recoverable via the
      // /kanban/archived sub-page (Phase 3).
      validation: { rule: schema.boolean() },
      factory: () => false,
    },
  },

  // The kanban surface has a dedicated dashboard page (`/kanban`),
  // not the auto-derived `/models/board` viewer — the sidebar entry is
  // hand-added in `dashboard-utils.ts` / `sidebar.ts` and points at
  // the real page. Hiding the auto-row keeps it from double-listing.
  dashboard: { enabled: false },
} as const)
