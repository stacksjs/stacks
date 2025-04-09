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
      displayable: ['id', 'cart_id', 'product_id', 'quantity', 'unit_price', 'total_price'],
      searchable: ['id', 'cart_id', 'product_id'],
      sortable: ['created_at', 'updated_at', 'quantity', 'unit_price'],
      filterable: ['cart_id', 'product_id'],
    },

    useSeeder: {
      count: 50,
    },

    useApi: {
      uri: 'cart-items',
    },

    observe: true,
  },

  belongsTo: ['Cart', 'ProductItem'],

  attributes: {
    quantity: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
      factory: faker => faker.number.int({ min: 1, max: 10 }),
    },

    unit_price: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 1, max: 100, dec: 2 })),
    },

    total_price: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 1, max: 1000, dec: 2 })),
    },

    tax_rate: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
      },
      factory: faker => faker.number.float({ min: 0, max: 20, fractionDigits: 2 }),
    },

    tax_amount: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 50, dec: 2 })),
    },

    discount_percentage: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
      },
      factory: faker => faker.helpers.maybe(() => faker.number.float({ min: 0, max: 50, fractionDigits: 2 }), { probability: 0.3 }),
    },

    discount_amount: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.helpers.maybe(() => Number.parseFloat(faker.commerce.price({ min: 0, max: 25, dec: 2 })), { probability: 0.3 }),
    },

    product_name: {
      required: true,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
      },
      factory: faker => faker.commerce.productName(),
    },

    product_sku: {
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
      },
      factory: faker => faker.helpers.maybe(() => faker.string.alphanumeric(10), { probability: 0.8 }),
    },

    product_image: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
      },
      factory: faker => faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }),
    },

    notes: {
      required: false,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(500),
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
