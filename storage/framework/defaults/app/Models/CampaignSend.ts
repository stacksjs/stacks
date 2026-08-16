import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'CampaignSend',
  table: 'campaign_sends',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['Team', 'Campaign', 'Subscriber', 'EmailList', 'CampaignVariant'],

  indexes: [
    {
      name: 'campaign_sends_idempotency_unique',
      columns: ['idempotency_key'],
      unique: true,
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'campaign-sends',
      routes: ['index', 'show'],
      // Per-recipient send records carry email + delivery status. Treat
      // as PII and require auth on all read paths. The transactional
      // owner-only views in the dashboard are gated separately.
      middleware: ['auth', 'team'],
    },
  },

  attributes: {
    campaignId: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 10 }),
    },

    subscriberId: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: () => null,
    },

    emailListId: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: () => null,
    },

    status: {
      required: true,
      fillable: true,
      default: 'queued',
      validation: {
        rule: schema.enum([
          'queued', 'deferred', 'sending', 'sent', 'delivered', 'failed',
          'undelivered', 'bounced', 'complained', 'suppressed', 'cancelled',
        ]),
      },
      factory: faker => faker.helpers.arrayElement(['sent', 'sent', 'sent', 'queued', 'failed', 'bounced']),
    },

    channel: {
      required: true,
      fillable: true,
      default: 'email',
      validation: {
        rule: schema.enum(['email', 'sms', 'push']),
      },
      factory: faker => faker.helpers.arrayElement(['email', 'sms']),
    },

    recipient: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.internet.email(),
    },

    idempotencyKey: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.string.uuid(),
    },

    providerMessageId: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.string.uuid(),
    },

    error: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => null,
    },

    sentAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: faker => faker.date.recent({ days: 7 }).toISOString().slice(0, 19).replace('T', ' '),
    },

    openedAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    clickedAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    deliveredAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    failedAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    segments: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
      factory: () => 1,
    },

    cost: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: () => 0,
    },

    metadata: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.json(),
      },
      factory: () => JSON.stringify({}),
    },
  },
} as const)
