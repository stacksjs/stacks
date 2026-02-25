import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Subscriber',
  table: 'subscribers',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 10,
    },
    useApi: {
      uri: 'subscribers',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['User'],
  hasMany: ['SubscriberEmail'],

  attributes: {
    email: {
      unique: true,
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

    status: {
      required: true,
      order: 2,
      fillable: true,
      default: 'subscribed',
      validation: {
        rule: schema.enum(['subscribed', 'unsubscribed', 'bounced', 'pending']),
      },
      factory: faker => faker.helpers.arrayElement(['subscribed', 'subscribed', 'subscribed', 'unsubscribed', 'pending']),
    },

    source: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
      },
      factory: faker => faker.helpers.arrayElement(['homepage', 'blog', 'api', 'dashboard', 'import']),
    },

    unsubscribedAt: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },
  },
} as const)
