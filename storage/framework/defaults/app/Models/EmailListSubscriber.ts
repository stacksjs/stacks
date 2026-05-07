import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Pivot row between Subscriber and EmailList.
 *
 * One subscriber can be on many lists; the subscribers.email unique
 * constraint stays intact because membership lives here. Each pivot
 * row carries its own UUID, which doubles as the per-list unsubscribe
 * token — that lets a recipient drop "Weekly Digest" via one link
 * without dropping every other list (or transactional mail).
 */
export default defineModel({
  name: 'EmailListSubscriber',
  table: 'email_list_subscribers',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['EmailList', 'Subscriber'],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'email-list-subscribers',
      routes: ['index', 'show'],
      // The pivot leaks list-membership PII (which addresses are on
      // which list, signup source, status). Auth-gate it. Public
      // unsubscribe goes through the dedicated token route, not this
      // CRUD surface.
      middleware: ['auth'],
    },
  },

  attributes: {
    emailListId: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 8 }),
    },

    subscriberId: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },

    status: {
      required: true,
      fillable: true,
      default: 'subscribed',
      validation: {
        rule: schema.enum(['subscribed', 'unsubscribed', 'pending', 'bounced']),
      },
      factory: faker => faker.helpers.arrayElement(['subscribed', 'subscribed', 'subscribed', 'unsubscribed']),
    },

    source: {
      required: false,
      fillable: true,
      default: 'api',
      validation: {
        rule: schema.string().max(100),
      },
      factory: faker => faker.helpers.arrayElement(['homepage', 'blog', 'landing-page', 'api', 'import']),
    },

    subscribedAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: faker => faker.date.recent({ days: 90 }).toISOString().slice(0, 19).replace('T', ' '),
    },

    unsubscribedAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },
  },
} as const)
