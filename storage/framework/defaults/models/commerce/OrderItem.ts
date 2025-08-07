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
    quantity: {
      default: 1,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
        message: {
          min: 'Quantity must be at least 1',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 5 }),
    },

    price: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
        message: {
          min: 'Price cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 5, max: 50 }),
    },

    special_instructions: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.sentence(),
    },
  },
} satisfies Model
