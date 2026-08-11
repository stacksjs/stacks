import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'EmailWebhookEvent',
  table: 'email_webhook_events',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'email_webhook_events_provider_event_unique',
      columns: ['provider', 'event_id'],
      unique: true,
    },
  ],

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'email-webhook-events',
      routes: ['index', 'show', 'destroy'],
      middleware: ['auth'],
    },
  },

  attributes: {
    provider: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.enum(['mailgun', 'postmark', 'ses', 'sendgrid']),
      },
    },
    eventId: {
      required: true,
      hidden: true,
      validation: {
        rule: schema.string().required().max(512),
      },
    },
    processedAt: {
      required: true,
      validation: {
        rule: schema.timestamp().required(),
      },
    },
  },

  dashboard: { enabled: false },
} as const)
