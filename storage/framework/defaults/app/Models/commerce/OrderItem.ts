import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
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
      // Integer minor units, in the same range as Product.price.
      factory: faker => faker.number.int({ min: 100, max: 10000 }),
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
} as const)
