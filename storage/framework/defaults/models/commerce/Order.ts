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
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELED']),
    },

    totalAmount: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
      },
      factory: faker => faker.number.int({ min: 100, max: 2000 }),
    },

    taxAmount: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 10, max: 200 }),
    },

    discountAmount: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 150 }),
    },

    deliveryFee: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },

    tipAmount: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 200 }),
    },

    orderType: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['DINE_IN', 'TAKEOUT', 'DELIVERY']),
    },

    deliveryAddress: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.location.streetAddress(),
    },

    specialInstructions: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    },

    estimatedDeliveryTime: {
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
