import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'SubscriberEmail',
  table: 'subscriber_emails',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 20,
    },
    useApi: {
      uri: 'subscriber-emails',
      routes: ['index', 'store', 'show'],
    },
  },

  belongsTo: ['Subscriber'],

  attributes: {
    email: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().email(),
        message: {
          email: 'Please provide a valid email address',
        },
      },
      factory: faker => faker.internet.email(),
    },

    source: {
      required: false,
      order: 2,
      fillable: true,
      default: 'homepage',
      validation: {
        rule: schema.string().max(100),
      },
      factory: faker => faker.helpers.arrayElement(['homepage', 'blog', 'notification-popup', 'footer']),
    },

    ipAddress: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(45),
      },
    },
  },
} as const)
