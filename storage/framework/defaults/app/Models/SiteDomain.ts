import { defineModel, siteOwnership } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A custom domain routed to a Site. Only rows with `verifiedAt` set resolve
 * traffic - verification proves the school controls the DNS before we serve
 * their content on it. `isPrimary` names the canonical host: sessions are
 * host-scoped cookies, so every other host 301s there and portal logins
 * always land on one origin.
 */
export default defineModel({
  name: 'SiteDomain',
  table: 'site_domains',
  primaryKey: 'id',
  autoIncrement: true,

  // Owned through the site, which belongs to a team, so the owner is the set of
  // site ids the caller's team owns rather than a single id (stacksjs/stacks#2375).
  ownership: siteOwnership(),

  traits: {
    useTimestamps: true,
    observe: true, // domain changes clear the host-resolution cache

    useApi: {
      uri: 'site-domains',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
      middleware: ['auth'],
    },
  },

  belongsTo: ['Site'],

  attributes: {
    domain: {
      required: true,
      order: 1,
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().min(4).max(253),
      },
      factory: faker => faker.internet.domainName(),
    },

    isPrimary: {
      required: false,
      order: 2,
      fillable: true,
      default: false,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => false,
    },

    verifiedAt: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    sslStatus: {
      required: false,
      order: 4,
      fillable: true,
      default: 'pending',
      validation: {
        rule: schema.enum(['pending', 'issued', 'failed'] as const),
      },
      factory: () => 'pending',
    },
  },
})
