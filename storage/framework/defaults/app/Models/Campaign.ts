import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Campaign',
  table: 'campaigns',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['EmailList'],
  hasMany: ['CampaignSend'],

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
      // Newsletter sends use 'sending' / 'sent' / 'cancelled' / 'failed'.
      // The legacy multi-channel statuses (active / completed / archived)
      // are kept for compatibility with non-email campaign types.
      validation: {
        rule: schema.enum([
          'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed',
          'active', 'completed', 'archived',
        ]),
      },
      factory: faker => faker.helpers.arrayElement(['draft', 'scheduled', 'sent', 'sending', 'completed']),
    },

    // ── Email-specific fields (used when type === 'email') ────────────
    // The newsletter pipeline writes these. Other campaign types
    // (sms/push/social) leave them null.

    subject: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.lorem.sentence(6),
    },

    template: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.helpers.arrayElement(['newsletter-default', 'product-update', 'promo']),
    },

    text: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.paragraphs(2),
    },

    fromName: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
      },
      factory: faker => faker.company.name(),
    },

    fromAddress: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().email().max(255),
      },
      factory: faker => faker.internet.email(),
    },

    emailListId: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 8 }),
    },

    scheduledAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        return faker.date.soon({ days: 14 }).toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    sentAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
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
} as const)
