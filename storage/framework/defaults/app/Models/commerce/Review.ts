import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Review',
  table: 'reviews',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'productId', 'rating', 'title', 'content', 'isVerifiedPurchase', 'isApproved'],
      searchable: ['title', 'content', 'productId'],
      sortable: ['rating', 'createdAt', 'updatedAt', 'helpfulVotes'],
      filterable: ['productId', 'rating', 'isVerifiedPurchase', 'isApproved'],
    },

    useSeeder: {
      count: 50,
    },

    useApi: {
      uri: 'product-reviews',
      middleware: ['auth'],
    },

    observe: true,
  },

  belongsTo: ['Product', 'Customer'],

  attributes: {
    /**
     * One to five stars, or absent.
     *
     * A review is a rating, a written comment, or both, and which of those a
     * shop asks for is the shop's decision - some want a star out of a
     * one-tap prompt, some want prose from a verified buyer, most want either.
     * `required()` here made the first and third impossible: a comment with no
     * star failed validation, so a store that wanted written feedback had to
     * invent a rating to carry it and then filter that invention back out of
     * its own averages.
     *
     * The column has always been nullable; only this rule disagreed. Null means
     * "not rated" and is excluded from an average rather than counted as zero -
     * see `fetchStats` in commerce/products/reviews.
     *
     * `store()` enforces the other half of the rule: a review with neither a
     * rating nor content is not a review, and is rejected there because a
     * cross-field check cannot be expressed on a single attribute.
     */
    rating: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(1).max(5),
        message: {
          min: 'Rating must be at least 1',
          max: 'Rating cannot be more than 5',
        },
      },
      // Roughly one in six is a comment with no star, so seeded data exercises
      // the unrated path rather than only ever the happy one.
      factory: faker => faker.datatype.boolean({ probability: 0.84 })
        ? faker.number.int({ min: 1, max: 5 })
        : null,
    },

    title: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          max: 'Title must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.lorem.sentence({ min: 3, max: 8 }),
    },

    content: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().max(2000),
        message: {
          max: 'Review content must have a maximum of 2000 characters',
        },
      },
      // And roughly one in five is a bare star with nothing written, which is
      // what a one-tap rating prompt produces.
      factory: faker => faker.datatype.boolean({ probability: 0.8 })
        ? faker.lorem.paragraphs({ min: 1, max: 3 })
        : '',
    },

    isVerifiedPurchase: {
      default: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.7 }),
    },

    isApproved: {
      default: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.9 }),
    },

    isFeatured: {
      default: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.9 }),
    },

    helpfulVotes: {
      order: 9,
      default: 0,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 200 }),
    },

    unhelpfulVotes: {
      order: 10,
      default: 0,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 50 }),
    },

    purchaseDate: {
      order: 11,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.date.past({ years: 1 }).toISOString(),
    },

    images: {
      order: 12,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => 'test',
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
