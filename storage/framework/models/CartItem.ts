import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'CartItem',
  table: 'cart_items',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'cartId', 'productId', 'quantity', 'unitPrice', 'totalPrice'],
      searchable: ['id', 'cartId', 'productId'],
      sortable: ['createdAt', 'updatedAt', 'quantity', 'unitPrice'],
      filterable: ['cartId', 'productId'],
    },

    useSeeder: {
      count: 50,
    },

    useApi: {
      uri: 'cart-items',
    },

    observe: true,
  },

  belongsTo: ['Cart'],

  attributes: {
    quantity: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
      },
      factory: faker => faker.number.int({ min: 1, max: 10 }),
    },

    unitPrice: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 1, max: 100, dec: 2 })),
    },

    totalPrice: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 1, max: 1000, dec: 2 })),
    },

    taxRate: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
      },
      factory: faker => faker.number.float({ min: 0, max: 20, fractionDigits: 2 }),
    },

    taxAmount: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 50, dec: 2 })),
    },

    discountPercentage: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
      },
      factory: faker => faker.helpers.maybe(() => faker.number.float({ min: 0, max: 50, fractionDigits: 2 }), { probability: 0.3 }),
    },

    discountAmount: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.helpers.maybe(() => Number.parseFloat(faker.commerce.price({ min: 0, max: 25, dec: 2 })), { probability: 0.3 }),
    },

    productName: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
      },
      factory: faker => faker.commerce.productName(),
    },

    productSku: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
      },
      factory: faker => faker.helpers.maybe(() => faker.string.alphanumeric(10), { probability: 0.8 }),
    },

    productImage: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }),
    },

    notes: {
      order: 11,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
