import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Notification',
  table: 'notifications',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 30,
    },
    useApi: {
      uri: 'notifications',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['User'],

  attributes: {
    type: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.enum(['email', 'sms', 'push', 'slack', 'webhook']),
      },
      factory: faker => faker.helpers.arrayElement(['email', 'sms', 'push', 'slack', 'webhook']),
    },

    channel: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(50),
      },
      factory: faker => faker.helpers.arrayElement(['mail', 'database', 'broadcast', 'slack']),
    },

    recipient: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.internet.email(),
    },

    subject: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.helpers.arrayElement([
        'Welcome!', 'Order Shipped', 'New Message', 'Daily Report',
        'Payment Received', 'Account Updated', 'Security Alert',
        'New Comment', 'Subscription Renewed', 'Password Reset',
      ]),
    },

    body: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(5000),
      },
      factory: faker => faker.lorem.paragraph(),
    },

    status: {
      required: true,
      fillable: true,
      default: 'pending',
      validation: {
        rule: schema.enum(['pending', 'sent', 'delivered', 'failed', 'read']),
      },
      factory: faker => faker.helpers.arrayElement(['sent', 'delivered', 'delivered', 'failed', 'read']),
    },

    readAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        if (faker.datatype.boolean()) {
          return faker.date.recent().toISOString().slice(0, 19).replace('T', ' ')
        }
        return null
      },
    },

    sentAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        return faker.date.recent().toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    metadata: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => JSON.stringify({ source: 'system' }),
    },
  },
} as const)
