import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'OrderItem',
  table: 'order_items',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  belongsTo: ['Order', 'Product'],

  attributes: {
    order_id: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => '', // This will be filled by the Order factory
    },

    product_id: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 50 }), // Assuming 50 products
    },

    quantity: {
      required: true,
      default: 1,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
        message: {
          min: 'Quantity must be at least 1',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 5 }),
    },

    price: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Price cannot be negative',
        },
      },
      factory: faker => faker.number.float({ min: 5, max: 50 }),
    },

    special_instructions: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().nullable(),
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
    },
  },
} satisfies Model
