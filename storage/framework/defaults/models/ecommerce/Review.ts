import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Review',
  table: 'reviews',
  primaryKey: 'id',
  autoIncrement: false, // Using UUID instead of auto-increment

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'product_id', 'rating', 'title', 'content', 'is_verified_purchase', 'is_approved'],
      searchable: ['title', 'content', 'product_id'],
      sortable: ['rating', 'created_at', 'updated_at', 'helpful_votes'],
      filterable: ['product_id', 'rating', 'is_verified_purchase', 'is_approved'],
    },

    useSeeder: {
      count: 50,
    },

    useApi: {
      uri: 'product-reviews',
      routes: ['index', 'store', 'show'],
    },

    observe: true,
  },

  belongsTo: ['Product', 'Customer'],

  attributes: {
    rating: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(1).max(5),
        message: {
          min: 'Rating must be at least 1',
          max: 'Rating cannot be more than 5',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 5 }),
    },

    title: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Title must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.lorem.sentence({ min: 3, max: 8 }),
    },

    content: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(2000),
        message: {
          maxLength: 'Review content must have a maximum of 2000 characters',
        },
      },
      factory: faker => faker.lorem.paragraphs({ min: 1, max: 3 }),
    },

    is_verified_purchase: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.7 }),
    },

    is_approved: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.9 }),
    },

    is_featured: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.9 }),
    },

    helpful_votes: {
      required: false,
      order: 9,
      default: 0,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 200 }),
    },

    unhelpful_votes: {
      required: false,
      order: 10,
      default: 0,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 50 }),
    },

    purchase_date: {
      required: false,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.date.past({ years: 1 }).toISOString(),
    },

    images: {
      required: false,
      order: 12,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        const hasImages = faker.datatype.boolean({ probability: 0.3 })
        if (hasImages) {
          const imageCount = faker.number.int({ min: 1, max: 5 })
          const images = Array.from({ length: imageCount }, () => faker.image.url())
          return JSON.stringify(images)
        }
        return JSON.stringify([])
      },
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
