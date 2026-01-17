import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Comment',
  table: 'comments',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 25,
    },
    useApi: {
      uri: 'comments',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Post', 'User'],

  attributes: {
    authorName: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(100),
      },
      factory: faker => faker.person.fullName(),
    },

    authorEmail: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().email(),
      },
      factory: faker => faker.internet.email(),
    },

    content: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().min(1).max(2000),
      },
      factory: faker => faker.lorem.paragraph(),
    },

    postTitle: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.lorem.sentence(),
    },

    status: {
      required: true,
      fillable: true,
      default: 'pending',
      validation: {
        rule: schema.enum(['pending', 'approved', 'spam', 'trash']),
      },
      factory: faker => faker.helpers.arrayElement(['pending', 'approved', 'spam', 'approved', 'approved']),
    },

    ipAddress: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(45),
      },
      factory: faker => faker.internet.ip(),
    },

    userAgent: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
      },
      factory: faker => faker.internet.userAgent(),
    },

    isApproved: {
      required: false,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 0, max: 1 }),
    },
  },
} satisfies Model
