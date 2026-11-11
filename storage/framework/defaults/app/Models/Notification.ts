import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'Notification',
  table: 'notifications',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    gdpr: { erasure: 'delete', basis: 'contract', purpose: 'In-app notifications' },
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 30,
    },
    useApi: {
      uri: 'notifications',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
      middleware: ['auth'],
    },
  },

  // Cascade, as the framework's own key repair has always made it
  // (ensureNotificationForeignKeys): a user's notifications go with the user.
  belongsTo: [{ model: 'User', onDelete: 'cascade' }],

  attributes: {
    type: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.helpers.arrayElement([
        'order.shipped',
        'payment.received',
        'security.alert',
        'subscription.renewed',
      ]),
    },

    data: {
      personal: true,
      type: 'text',
      required: true,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => JSON.stringify({
        body: faker.lorem.sentence(),
        source: 'system',
      }),
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

  },

  dashboard: {
    columns: ['type', 'user', 'readAt', 'createdAt'],
  },
} as const)
