import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Campaign',
  table: 'campaigns',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 10,
    },
    useApi: {
      uri: 'campaigns',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().min(3).max(255),
      },
      factory: faker => faker.helpers.arrayElement([
        'Summer Sale 2024', 'Black Friday Deals', 'Holiday Special',
        'New Product Launch', 'Customer Appreciation', 'Flash Sale',
        'Welcome Series', 'Re-engagement', 'Newsletter Weekly',
        'Product Updates',
      ]),
    },

    description: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(1000),
      },
      factory: faker => faker.lorem.paragraph(),
    },

    type: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.enum(['email', 'sms', 'push', 'social', 'multi-channel']),
      },
      factory: faker => faker.helpers.arrayElement(['email', 'sms', 'push', 'social', 'multi-channel']),
    },

    status: {
      required: true,
      fillable: true,
      default: 'draft',
      validation: {
        rule: schema.enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'archived']),
      },
      factory: faker => faker.helpers.arrayElement(['draft', 'scheduled', 'active', 'completed', 'active']),
    },

    audienceSize: {
      required: false,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 100, max: 50000 }),
    },

    sentCount: {
      required: false,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 10000 }),
    },

    openRate: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
      },
      factory: faker => faker.number.float({ min: 15, max: 45, fractionDigits: 1 }),
    },

    clickRate: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
      },
      factory: faker => faker.number.float({ min: 2, max: 15, fractionDigits: 1 }),
    },

    conversionRate: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
      },
      factory: faker => faker.number.float({ min: 0.5, max: 8, fractionDigits: 1 }),
    },

    budget: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
    },

    spent: {
      required: false,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.float({ min: 0, max: 5000, fractionDigits: 2 }),
    },

    startDate: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        return faker.date.recent({ days: 30 }).toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    endDate: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        return faker.date.soon({ days: 30 }).toISOString().slice(0, 19).replace('T', ' ')
      },
    },
  },
} satisfies Model
