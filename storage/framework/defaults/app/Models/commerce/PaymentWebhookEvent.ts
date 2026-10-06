import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * A payment webhook delivery already applied. Providers retry until they are
 * answered, so commerce records each event here in the same transaction as the
 * order update it makes, and a retry finds its row and does nothing.
 */
export default defineModel({
  name: 'PaymentWebhookEvent',
  table: 'payment_webhook_events',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'payment_webhook_events_provider_event_unique',
      columns: ['provider', 'event_id'],
      unique: true,
    },
  ],

  // Written by the system on a provider's behalf, never for a caller.
  ownership: false,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    /** The payment driver that verified it: `stripe`, `adyen`, or one you registered. */
    provider: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().required().max(64),
      },
    },
    eventId: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().required().max(512),
      },
    },
    processedAt: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.timestamp().required(),
      },
    },
  },

  dashboard: { enabled: false },
} as const)
