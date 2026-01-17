import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'EmailList',
  table: 'email_lists',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 8,
    },
    useApi: {
      uri: 'email-lists',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(100),
      },
      factory: faker => faker.helpers.arrayElement([
        'Newsletter Subscribers', 'VIP Customers', 'Product Updates',
        'Beta Testers', 'Blog Subscribers', 'Marketing List',
        'Enterprise Leads', 'Event Attendees',
      ]),
    },

    description: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
      },
      factory: faker => faker.lorem.sentence(),
    },

    subscriberCount: {
      required: false,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 100, max: 25000 }),
    },

    activeCount: {
      required: false,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 50, max: 20000 }),
    },

    unsubscribedCount: {
      required: false,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 500 }),
    },

    bouncedCount: {
      required: false,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },

    status: {
      required: true,
      fillable: true,
      default: 'active',
      validation: {
        rule: schema.enum(['active', 'inactive', 'archived']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'active', 'active', 'inactive']),
    },

    isPublic: {
      required: false,
      fillable: true,
      default: 1,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 0, max: 1 }),
    },

    doubleOptIn: {
      required: false,
      fillable: true,
      default: 1,
      validation: {
        rule: schema.number(),
      },
      factory: () => 1,
    },
  },
} satisfies Model
