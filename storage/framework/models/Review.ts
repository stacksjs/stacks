import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Review',
  table: 'reviews',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'userId', 'trailId', 'rating', 'title'],
      searchable: ['title', 'content'],
      sortable: ['createdAt', 'rating', 'helpfulCount'],
      filterable: ['rating', 'trailId'],
    },
    useSeeder: {
      count: 100,
    },
    useApi: {
      uri: 'reviews',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['User', 'Trail'],

  attributes: {
    rating: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1).max(5),
        message: {
          required: 'Rating is required',
          min: 'Rating must be at least 1',
          max: 'Rating must be at most 5',
        },
      },
      factory: (faker) => faker.number.int({ min: 3, max: 5 }),
    },

    title: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(200),
      },
      factory: (faker) => faker.helpers.arrayElement([
        'Amazing trail!',
        'Beautiful views',
        'Great workout',
        'Perfect for beginners',
        'Challenging but worth it',
        'Best trail in the area',
        'Highly recommend',
        'Nice and peaceful',
      ]),
    },

    content: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required().min(10).max(2000),
        message: {
          required: 'Review content is required',
          min: 'Review must be at least 10 characters',
        },
      },
      factory: (faker) => faker.lorem.paragraphs(2),
    },

    visitDate: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => faker.date.recent({ days: 90 }).toISOString().split('T')[0],
    },

    conditions: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => faker.helpers.arrayElement(['excellent', 'good', 'fair', 'poor', 'muddy', 'icy']),
    },

    helpfulCount: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: (faker) => faker.number.int({ min: 0, max: 200 }),
    },

    photos: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => null,
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
