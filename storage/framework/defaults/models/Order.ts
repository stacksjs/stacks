import type { Faker } from '@stacksjs/faker'
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Order',
  table: 'orders',
  primaryKey: 'id',
  autoIncrement: false, // Using UUID instead of auto-increment

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'customer_id', 'status', 'total_amount', 'order_type', 'created_at'],
      searchable: ['id', 'customer_id', 'status', 'order_type'],
      sortable: ['created_at', 'updated_at', 'total_amount', 'estimated_delivery_time'],
      filterable: ['status', 'order_type', 'customer_id'],
    },

    useSeeder: {
      count: 20,
    },

    useApi: {
      uri: 'orders',
      routes: ['index', 'store', 'show'],
    },

    observe: true,
  },

  belongsTo: ['User', 'Coupon'],
  hasMany: ['Order'],

  attributes: {
    customer_id: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.string.uuid(),
    },

    status: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.helpers.arrayElement(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELED']),
    },

    total_amount: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: (faker: Faker) => Number.parseFloat(faker.commerce.price({ min: 10, max: 200, dec: 2 })),
    },

    tax_amount: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: (faker: Faker) => Number.parseFloat(faker.commerce.price({ min: 1, max: 20, dec: 2 })),
    },

    discount_amount: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: (faker: Faker) => Number.parseFloat(faker.commerce.price({ min: 0, max: 15, dec: 2 })),
    },

    delivery_fee: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: (faker: Faker) => Number.parseFloat(faker.commerce.price({ min: 0, max: 10, dec: 2 })),
    },

    tip_amount: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: (faker: Faker) => Number.parseFloat(faker.commerce.price({ min: 0, max: 20, dec: 2 })),
    },

    order_type: {
      required: true,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.helpers.arrayElement(['DINE_IN', 'TAKEOUT', 'DELIVERY']),
    },

    delivery_address: {
      required: false, // Will be validated conditionally based on order_type
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.location.streetAddress(),
    },

    special_instructions: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    },

    estimated_delivery_time: {
      required: false,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.string(), // Store as ISO date string
      },
      factory: (faker: Faker) => {
        const now = new Date()
        const futureDate = new Date(now.getTime() + faker.number.int({ min: 15, max: 120 }) * 60000)
        return futureDate.toISOString()
      },
    },

    applied_coupon_id: {
      required: false,
      order: 12,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.2 }),
    },

    order_items: {
      required: true,
      order: 13,
      fillable: true,
      validation: {
        rule: schema.string(), // Store as JSON string
      },
      factory: (faker: Faker) => {
        const itemCount = faker.number.int({ min: 1, max: 5 })
        const items = []

        for (let i = 0; i < itemCount; i++) {
          items.push({
            product_id: faker.string.uuid(),
            quantity: faker.number.int({ min: 1, max: 5 }),
            price: Number.parseFloat(faker.commerce.price({ min: 5, max: 50, dec: 2 })),
            special_instructions: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
          })
        }

        return JSON.stringify(items)
      },
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
