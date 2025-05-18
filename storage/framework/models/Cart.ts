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
        rule: schema.enum(['active', 'abandoned', 'converted', 'expired'] as const),
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
      required: true,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: faker => faker.date.past().getTime(),
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
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().max(1000),
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    },

    appliedCouponId: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.2 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
