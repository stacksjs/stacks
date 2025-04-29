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
      displayable: ['id', 'title', 'author', 'category', 'views', 'status', 'poster'],
      searchable: ['title', 'author', 'category', 'body'],
      sortable: ['published_at', 'views', 'comments'],
      filterable: ['category', 'status'],
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
        rule: schema.string().minLength(3).maxLength(255),
        message: {
          minLength: 'Title must have a minimum of 3 characters',
          maxLength: 'Title must have a maximum of 255 characters',
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

    body: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().minLength(10),
        message: {
          minLength: 'Post body must have a minimum of 10 characters',
        },
      },
      factory: faker => faker.lorem.paragraphs(3),
    },

    views: {
      required: false,
      order: 6,
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
      required: true,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Published timestamp cannot be negative',
        },
      },
      factory: faker => faker.date.past().getTime(),
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
  },
} satisfies Model
