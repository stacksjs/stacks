import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'Comment',
  table: 'comments',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    gdpr: { erasure: 'anonymize', basis: 'legitimate_interests', purpose: 'Comments on posts' },
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 25,
    },
    useApi: {
      uri: 'comments',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
      middleware: ['auth'],
    },
  },

  belongsTo: ['Post', 'User'],

  attributes: {
    authorName: {
      personal: true,
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(100),
      },
      factory: faker => faker.person.fullName(),
    },

    authorEmail: {
      personal: true,
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

    body: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(2000),
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
      personal: true,
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(45),
      },
      factory: faker => faker.internet.ip(),
    },

    userAgent: {
      personal: true,
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
} as const)
