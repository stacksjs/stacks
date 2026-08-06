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
      middleware: ['auth'],
    },
  },

  belongsTo: ['User'],

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
} as const)
