import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'CampaignSend',
  table: 'campaign_sends',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['Campaign', 'Subscriber', 'EmailList'],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'campaign-sends',
      routes: ['index', 'show'],
      // Per-recipient send records carry email + delivery status. Treat
      // as PII and require auth on all read paths. The transactional
      // owner-only views in the dashboard are gated separately.
      middleware: ['auth'],
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
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },

    emailListId: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 8 }),
    },

    status: {
      required: true,
      fillable: true,
      default: 'queued',
      validation: {
        rule: schema.enum(['queued', 'sent', 'failed', 'bounced', 'complained']),
      },
      factory: faker => faker.helpers.arrayElement(['sent', 'sent', 'sent', 'queued', 'failed', 'bounced']),
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
  },
} as const)
