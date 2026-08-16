import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A path-level redirect on a site. Written automatically when a page's slug
 * or ancestry changes (`source: 'slug-change'`) so old links keep working,
 * and manually from the dashboard (`source: 'manual'`). Resolved by the CMS
 * fallback after page lookup misses.
 */
export default defineModel({
  name: 'Redirect',
  table: 'redirects',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'redirects_site_from_unique',
      columns: ['site_id', 'from_path'],
      unique: true,
    },
  ],

  traits: {
    useTimestamps: true,
    useApi: {
      middleware: ['auth'],
      uri: 'redirects',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Site'],

  attributes: {
    fromPath: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().max(2048),
      },
      factory: faker => `/${faker.lorem.slug()}`,
    },

    toPath: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(2048),
      },
      factory: faker => `/${faker.lorem.slug()}`,
    },

    statusCode: {
      required: false,
      order: 3,
      fillable: true,
      default: 301,
      validation: {
        // schema.enum is string-typed; the numeric range pins 301/302 (the
        // read path coerces anything else to 301 anyway).
        rule: schema.number().min(301).max(302),
      },
      factory: () => 301,
    },

    source: {
      required: false,
      order: 4,
      fillable: true,
      default: 'manual',
      validation: {
        rule: schema.enum(['slug-change', 'manual'] as const),
      },
      factory: () => 'manual',
    },
  },
} as const)
