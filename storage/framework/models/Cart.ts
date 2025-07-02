import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Cart',
  table: 'carts',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'customerId', 'status', 'totalItems', 'subtotal', 'total', 'expiresAt'],
      searchable: ['id', 'customerId', 'status'],
      sortable: ['createdAt', 'updatedAt', 'expiresAt', 'total'],
      filterable: ['status', 'customerId'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'carts',
    },

    observe: true,
  },

  hasMany: ['CartItem'],
  belongsTo: ['Customer', 'Coupon'],

  attributes: {
    status: {
      default: 'active',
      order: 1,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'abandoned', 'converted', 'expired']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'abandoned', 'converted', 'expired']),
    },

    totalItems: {
      default: 0,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 20 }),
    },

    subtotal: {
      default: 0,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 1000, dec: 2 })),
    },

    taxAmount: {
      default: 0,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 200, dec: 2 })),
    },

    discountAmount: {
      default: 0,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 100, dec: 2 })),
    },

    total: {
      default: 0,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 1200, dec: 2 })),
    },

    expiresAt: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.timestamp().required(),
      },
      factory: (faker) => {
        const date = faker.date.past()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    currency: {
      default: 'USD',
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string().max(3),
      },
      factory: faker => faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'JPY', 'AUD']),
    },

    notes: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().max(1000),
      },
      factory: faker => faker.lorem.sentence(),
    },

    appliedCouponId: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: () => 'test-coupon-id',
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
