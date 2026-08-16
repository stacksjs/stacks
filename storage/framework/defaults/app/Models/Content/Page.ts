import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A real CMS page: a block document served publicly at `path` on its site.
 *
 * `blocks` is the content - an ordered JSON array validated against the block
 * registry (`@stacksjs/cms` `validateBlocks`). One JSON column rather than
 * Section/Block rows so a page edit is one atomic write and a revision is a
 * row copy, not a snapshot-of-a-join.
 *
 * The `useApi` surface is the ADMIN surface (auth'd on both sides - the table
 * now carries draft content, and a public read route is how drafts leak).
 * Public visitors get pages through the stx servers' CMS fallback, which only
 * ever serves `status = 'published'` rows for the request's site.
 */
export default defineModel({
  name: 'Page',
  table: 'pages',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'pages_site_path_unique',
      columns: ['site_id', 'path'],
      unique: true,
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'title', 'slug', 'path', 'template', 'status', 'views'],
      searchable: ['title', 'slug', 'path'],
      sortable: ['views', 'conversions', 'publishedAt'],
      filterable: ['template', 'status'],
    },
    useApi: {
      middleware: ['auth'],
      uri: 'pages',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },

    useSeeder: {
      count: 10,
    },
  },

  belongsTo: ['Author', 'Site'],

  attributes: {
    title: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().min(3).max(255),
        message: {
          min: 'Title must have a minimum of 3 characters',
          max: 'Title must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.lorem.sentence(),
    },

    /** Last path segment, unique among siblings. */
    slug: {
      required: false,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.lorem.slug(),
    },

    /**
     * Materialized full path (`/admissions/visit`), unique per site. Derived
     * from the parent chain + slug on save; a slug change rewrites descendant
     * paths and leaves Redirect rows behind.
     */
    path: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(2048),
      },
      factory: faker => `/${faker.lorem.slug()}`,
    },

    /** Page-tree parent. Null for top-level pages. */
    parentId: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
      factory: () => null,
    },

    template: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().min(3),
        message: {
          min: 'Template must have a minimum of 3 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement(['default', 'landing', 'blog', 'contact']),
    },

    /** The block document. Ordered array of { id, type, props }. */
    blocks: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.json(),
      },
      factory: () => JSON.stringify([]),
    },

    metaDescription: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().max(320),
      },
      factory: faker => faker.lorem.sentence(),
    },

    status: {
      required: false,
      order: 8,
      fillable: true,
      default: 'draft',
      validation: {
        rule: schema.enum(['draft', 'published', 'scheduled', 'archived'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['draft', 'published']),
    },

    /** When a `scheduled` page goes live - enforced by the publish job. */
    scheduledAt: {
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    views: {
      required: false,
      order: 10,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Views count cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 1000 }),
    },

    publishedAt: {
      required: false,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
        message: {
          timestamp: 'Published timestamp must be a valid timestamp',
        },
      },
      factory: (faker) => {
        const date = faker.date.past()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    conversions: {
      required: false,
      order: 12,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Conversions count cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },
  },
} as const)
