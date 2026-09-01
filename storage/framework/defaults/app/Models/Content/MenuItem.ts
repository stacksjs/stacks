import { defineModel, parentOwnership } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * One entry in a Menu: either a link to a Page (`pageId`) or a raw `url` -
 * exactly one of the two. Nests one level via `parentId` for dropdowns.
 */
export default defineModel({
  name: 'MenuItem',
  table: 'menu_items',
  primaryKey: 'id',
  autoIncrement: true,

  // No owner of its own: these rows are owned by whoever owns the menu's site, and so its team
  // (stacksjs/stacks#2375). Resolved through the parent so it follows any change
  // to how Menu decides ownership.
  ownership: parentOwnership('Menu', 'menu_id'),

  traits: {
    useTimestamps: true,
    useApi: {
      middleware: ['auth'],
      uri: 'menu-items',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Menu', 'Page'],

  attributes: {
    label: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().min(1).max(120),
      },
      factory: faker => faker.lorem.words(2),
    },

    /** External or hand-written link. Null when the item points at a Page. */
    url: {
      required: false,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(2048),
      },
      factory: () => null,
    },

    target: {
      required: false,
      order: 3,
      fillable: true,
      default: '_self',
      validation: {
        rule: schema.enum(['_self', '_blank'] as const),
      },
      factory: () => '_self',
    },

    /** Dropdown parent within the same menu. */
    parentId: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
      factory: () => null,
    },

    position: {
      required: false,
      order: 5,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
    },

    /** `auth` items render only for signed-in visitors (portal links). */
    visibility: {
      required: false,
      order: 6,
      fillable: true,
      default: 'public',
      validation: {
        rule: schema.enum(['public', 'auth'] as const),
      },
      factory: () => 'public',
    },
  },
} as const)
