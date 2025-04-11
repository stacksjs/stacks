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
    useSearch: {
      displayable: ['id', 'title', 'user_id', 'status', 'approved_at', 'rejected_at'],
      searchable: ['title', 'body'],
      sortable: ['created_at', 'approved_at'],
      filterable: ['status', 'user_id'],
    },

    useSeeder: {
      count: 20,
    },

    useApi: {
      uri: 'comments',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['User'],

  attributes: {
    title: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().minLength(3).maxLength(255),
        message: {
          minLength: 'Title must have a minimum of 3 characters',
          maxLength: 'Title must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.lorem.sentence(),
    },

    body: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().minLength(10),
        message: {
          minLength: 'Comment body must have a minimum of 10 characters',
        },
      },
      factory: faker => faker.lorem.paragraphs(1),
    },

    status: {
      required: true,
      order: 4,
      fillable: true,
      default: 'Pending',
      validation: {
        rule: schema.enum(['Approved', 'Pending', 'Spam', 'Rejected']),
        message: {
          oneOf: 'Status must be either Approved, Pending, Spam, or Rejected',
        },
      },
      factory: faker => faker.helpers.arrayElement(['Approved', 'Pending', 'Spam', 'Rejected']),
    },

    approved_at: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Approved timestamp cannot be negative',
        },
      },
      factory: faker => faker.date.past().getTime(),
    },

    rejected_at: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Rejected timestamp cannot be negative',
        },
      },
      factory: faker => faker.date.past().getTime(),
    },
  },
} satisfies Model
