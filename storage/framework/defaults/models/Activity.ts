import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Activity',
  table: 'activities',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 50,
    },
    useApi: {
      uri: 'activities',
      routes: ['index', 'show'],
    },
  },

  belongsTo: ['User'],

  attributes: {
    type: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(50),
      },
      factory: faker => faker.helpers.arrayElement([
        'user.created', 'user.updated', 'user.deleted',
        'order.created', 'order.completed', 'order.cancelled',
        'product.created', 'product.updated', 'product.deleted',
        'post.published', 'comment.approved', 'login.success',
        'login.failed', 'subscription.renewed', 'payment.received',
      ]),
    },

    description: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
      },
      factory: faker => faker.lorem.sentence(),
    },

    subjectType: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
      },
      factory: faker => faker.helpers.arrayElement(['User', 'Order', 'Product', 'Post', 'Comment', 'Subscription']),
    },

    subjectId: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },

    causer: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
      },
      factory: faker => faker.person.fullName(),
    },

    properties: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => JSON.stringify({ ip: '192.168.1.1', browser: 'Chrome' }),
    },

    ipAddress: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(45),
      },
      factory: faker => faker.internet.ip(),
    },
  },
} as const)
