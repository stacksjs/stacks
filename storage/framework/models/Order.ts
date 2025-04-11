import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Order',
  table: 'orders',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'customerId', 'status', 'totalAmount', 'orderType', 'createdAt'],
      searchable: ['id', 'customerId', 'status', 'orderType'],
      sortable: ['createdAt', 'updatedAt', 'totalAmount', 'estimatedDeliveryTime'],
      filterable: ['status', 'orderType', 'customerId'],
    },

    useSeeder: {
      count: 20,
    },

    useApi: {
      uri: 'orders',
    },

    observe: true,
  },

  hasMany: ['OrderItem', 'Payment', 'LicenseKey'],
  belongsTo: ['Customer', 'Coupon'],

  attributes: {
    status: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.arrayElement(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELED']),
    },

    totalAmount: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 10, max: 200, dec: 2 })),
    },

    taxAmount: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 1, max: 20, dec: 2 })),
    },

    discountAmount: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 15, dec: 2 })),
    },

    deliveryFee: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 10, dec: 2 })),
    },

    tipAmount: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 20, dec: 2 })),
    },

    orderType: {
      required: true,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.arrayElement(['DINE_IN', 'TAKEOUT', 'DELIVERY']),
    },

    deliveryAddress: {
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.location.streetAddress(),
    },

    specialInstructions: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    },

    estimatedDeliveryTime: {
      required: false,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        const now = new Date()
        const futureDate = new Date(now.getTime() + faker.number.int({ min: 15, max: 120 }) * 60000)
        return futureDate.toISOString()
      },
    },

    appliedCouponId: {
      required: false,
      order: 12,
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
