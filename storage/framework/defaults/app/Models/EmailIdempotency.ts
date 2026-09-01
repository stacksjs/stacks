import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'EmailIdempotency',
  table: 'email_idempotency',
  primaryKey: 'id',
  autoIncrement: true,

  // An infrastructure table: rows are written by the system, not on behalf of a
  // caller, so no row has a per-caller owner to scope by. Writes are gated by
  // `middleware` instead. Declared rather than left silent (stacksjs/stacks#2375).
  ownership: false,

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
