import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Post',
  table: 'posts',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'title', 'author', 'views', 'status', 'poster'],
      searchable: ['title', 'author', 'body', 'excerpt'],
      sortable: ['published_at', 'views', 'comments'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 20,
    },
    categorizable: true,
    taggable: true,
    commentables: true,
    useApi: {
      uri: 'posts',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Author'],

  attributes: {
    title: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().min(3).max(255),
        message: {
          min: 'Title must have a minimum of 3 characters',
          max: 'Title must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.lorem.sentence(),
    },
    poster: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().url(),
        message: {
          url: 'Poster must be a valid URL',
        },
      },
      factory: faker => faker.image.url(),
    },

    content: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().min(10).max(1000),
        message: {
          min: 'Post body must have a minimum of 10 characters',
        },
      },
      factory: faker => faker.lorem.paragraphs(1),
    },

    excerpt: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string().min(10).max(500),
        message: {
          min: 'Excerpt must have a minimum of 10 characters',
          max: 'Excerpt must have a maximum of 500 characters',
        },
      },
      factory: faker => faker.lorem.paragraph(),
    },

    views: {
      required: false,
      order: 7,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Views count cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 1000 }),
    },

    publishedAt: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
        message: {
          timestamp: 'Published timestamp must be a valid timestamp',
        },
      },
      factory: (faker) => {
        const date = faker.date.past()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    status: {
      required: true,
      order: 9,
      fillable: true,
      default: 'draft',
      validation: {
        rule: schema.enum(['published', 'draft', 'archived']),
        message: {
          oneOf: 'Status must be either published, draft, or archived',
        },
      },
      factory: faker => faker.helpers.arrayElement(['published', 'draft', 'archived']),
    },

    isFeatured: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'Featured must be a number value',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 1 }),
    },
  },
} satisfies Model
