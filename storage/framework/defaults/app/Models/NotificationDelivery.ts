import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'NotificationDelivery',
  table: 'notification_deliveries',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'channel', 'recipient', 'subject', 'status', 'sentAt'],
      searchable: ['recipient', 'subject', 'body', 'error'],
      sortable: ['channel', 'recipient', 'status', 'sentAt', 'createdAt'],
      filterable: ['channel', 'status'],
    },
    useApi: {
      uri: 'notification-deliveries',
      routes: ['index', 'show', 'destroy'],
      middleware: ['auth'],
    },
  },

  attributes: {
    userId: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
    },

    channel: {
      type: 'string',
      required: true,
      fillable: true,
      validation: {
        rule: schema.enum(['email', 'sms', 'chat', 'database', 'push', 'broadcast']),
      },
    },

    recipient: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(1000),
      },
    },

    subject: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },

    body: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(10000),
      },
    },

    status: {
      type: 'string',
      required: true,
      fillable: true,
      default: 'pending',
      validation: {
        rule: schema.enum(['pending', 'sent', 'delivered', 'failed']),
      },
    },

    error: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(5000),
      },
    },

    metadata: {
      type: 'text',
      required: false,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },

    sentAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
    },
  },
} as const)
