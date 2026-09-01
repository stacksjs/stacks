import { defineModel, siteOwnership } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A named navigation slot on a site - `main`, `footer`, `portal`. The items
 * are MenuItem rows; templates fetch the tree by handle
 * (`fetchMenuTree(siteId, 'main')`) so navigation is content, not code.
 */
export default defineModel({
  name: 'Menu',
  table: 'menus',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'menus_site_handle_unique',
      columns: ['site_id', 'handle'],
      unique: true,
    },
  ],

  // Owned through the site, which belongs to a team, so the owner is the set of
  // site ids the caller's team owns rather than a single id (stacksjs/stacks#2375).
  ownership: siteOwnership(),

  traits: {
    useTimestamps: true,
    useApi: {
      middleware: ['auth'],
      uri: 'menus',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Site'],
  hasMany: ['MenuItem'],

  attributes: {
    handle: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(64).matches(/^[a-z0-9-]+$/),
      },
      factory: faker => faker.helpers.arrayElement(['main', 'footer', 'portal']),
    },

    name: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(255),
      },
      factory: faker => faker.lorem.words(2),
    },
  },
} as const)
