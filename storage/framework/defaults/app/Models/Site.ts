import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A public web property served by this app: one host (subdomain of
 * `config.sites.baseDomain`, plus any verified custom domains via
 * SiteDomain), one content tree, one theme. A team may own several - a main
 * site, a microsite, a campaign landing page - each with its own domain.
 *
 * The `useApi` surface is the ADMIN surface (auth'd, team-scoped). Public
 * visitors never read sites through it; the serving layer resolves the site
 * from the Host header (`@stacksjs/sites`).
 */
export default defineModel({
  name: 'Site',
  table: 'sites',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    observe: true, // site:updated clears the host-resolution cache

    useSeeder: {
      count: 2,
    },

    useApi: {
      uri: 'sites',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
      middleware: ['auth', 'team'],
    },

    useSearch: {
      displayable: ['id', 'name', 'subdomain', 'status'],
      searchable: ['name', 'subdomain'],
      sortable: ['name', 'createdAt'],
      filterable: ['status'],
    },
  },

  belongsTo: ['Team'],
  hasMany: ['SiteDomain'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(255),
        message: {
          min: 'Site name must have a minimum of 2 characters',
          max: 'Site name must have a maximum of 255 characters',
        },
      },
      factory: faker => `${faker.company.name()} School`,
    },

    subdomain: {
      required: true,
      order: 2,
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().min(2).max(63).matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
        message: {
          matches: 'Subdomain may only contain lowercase letters, numbers and hyphens',
        },
      },
      factory: faker => faker.internet.domainWord(),
    },

    status: {
      required: true,
      order: 3,
      fillable: true,
      default: 'active',
      validation: {
        rule: schema.enum(['active', 'suspended', 'archived'] as const),
      },
      factory: () => 'active',
    },

    /** Theme tokens, locale, analytics id - render-time knobs, JSON. */
    settings: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.json(),
      },
      factory: () => JSON.stringify({}),
    },

    timezone: {
      required: false,
      order: 5,
      fillable: true,
      default: 'America/New_York',
      validation: {
        rule: schema.string().max(64),
      },
      factory: () => 'America/New_York',
    },
  },

  dashboard: {
    highlight: true,
  },
})
