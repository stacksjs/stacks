import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Page',
  table: 'pages',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'title', 'author', 'template', 'views', 'conversions'],
      searchable: ['title', 'author', 'template'],
      sortable: ['views', 'conversions'],
      filterable: ['template'],
    },

    useSeeder: {
      count: 10,
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

    template: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().min(3),
        message: {
          min: 'Template must have a minimum of 3 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement(['default', 'landing', 'blog', 'contact']),
    },

    views: {
      required: false,
      order: 4,
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
      order: 6,
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

    conversions: {
      required: false,
      order: 5,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Conversions count cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },
  },
} satisfies Model
