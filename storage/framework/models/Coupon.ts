import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Coupon',
  table: 'coupons',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'code', 'discount_type', 'discount_value', 'is_active', 'start_date', 'end_date'],
      searchable: ['code', 'description', 'discount_type'],
      sortable: ['created_at', 'start_date', 'end_date', 'discount_value', 'usage_count'],
      filterable: ['discount_type', 'is_active'],
    },

    useSeeder: {
      count: 15,
    },

    useApi: {
      uri: 'coupons',
      routes: ['index', 'store', 'show'],
    },

    observe: true,
  },

  belongsTo: ['Product'],
  hasMany: ['Order'],

  attributes: {
    code: {
      required: true,
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(50),
        message: {
          maxLength: 'Code must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.string.alphanumeric(8).toUpperCase(),
    },

    description: {
      required: false,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.commerce.productDescription(),
    },

    discount_type: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.arrayElement(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_ITEM']),
    },

    discount_value: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0.01),
      },
      factory: faker => faker.number.float({ min: 5, max: 50 }),
    },

    min_order_amount: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 50, dec: 2 })),
    },

    max_discount_amount: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.helpers.maybe(() => Number.parseFloat(faker.commerce.price({ min: 5, max: 100, dec: 2 })), { probability: 0.7 }),
    },

    free_product_id: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.3 }),
    },

    is_active: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.8 }),
    },

    usage_limit: {
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
      factory: faker => faker.helpers.maybe(() => faker.number.int({ min: 1, max: 100 }), { probability: 0.6 }),
    },

    usage_count: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 50 }),
    },

    start_date: {
      required: true,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: faker => faker.date.recent().toISOString(),
    },

    end_date: {
      required: true,
      order: 12,
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: faker => faker.date.future().toISOString(),
    },

    applicable_products: {
      required: false,
      order: 13,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        // Generate product IDs array and stringify
        const count = faker.number.int({ min: 0, max: 5 })
        const productIds = Array.from({ length: count }, () => faker.string.uuid())
        return JSON.stringify(productIds)
      },
    },

    applicable_categories: {
      required: false,
      order: 14,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        // Generate category IDs array and stringify
        const count = faker.number.int({ min: 0, max: 3 })
        const categoryIds = Array.from({ length: count }, () => faker.string.uuid())
        return JSON.stringify(categoryIds)
      },
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
