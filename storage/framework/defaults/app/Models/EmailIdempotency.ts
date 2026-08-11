import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'EmailIdempotency',
  table: 'email_idempotency',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'email-idempotency',
      routes: ['index', 'show', 'destroy'],
      middleware: ['auth'],
    },
  },

  attributes: {
    idempotencyKey: {
      required: true,
      hidden: true,
      unique: true,
      validation: {
        rule: schema.string().required().max(255),
      },
    },
    messageId: {
      required: false,
      validation: {
        rule: schema.string().max(512),
      },
    },
    recipient: {
      required: false,
      hidden: true,
      validation: {
        rule: schema.string().max(2000),
      },
    },
    subject: {
      required: false,
      hidden: true,
      validation: {
        rule: schema.string().max(998),
      },
    },
    provider: {
      required: false,
      validation: {
        rule: schema.string().max(100),
      },
    },
    success: {
      required: true,
      default: true,
      validation: {
        rule: schema.boolean(),
      },
    },
  },

  dashboard: { enabled: false },
} as const)
