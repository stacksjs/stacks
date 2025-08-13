import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'PaymentProduct', // defaults to the sanitized file name
  table: 'payment_products', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true
  traits: {
    useSeeder: {
      count: 10,
    },
    useUuid: true,
  },
  attributes: {
    name: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(512),
        message: {
          string: 'type must be a string',
          required: 'type is required',
          max: 'type must have a maximum of 512 characters',
        },
      },
      factory: faker => faker.food.dish(),
    },

    description: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'description must be a string',
          required: 'description is required',
        },
      },
      factory: faker => faker.lorem.lines(3),
    },
    key: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          string: 'key must be a string',
          required: 'key is required',
        },
      },
      factory: faker => faker.string.alphanumeric(5),
    },

    unitPrice: {
      fillable: true,
      validation: {
        rule: schema.number().required(),
        message: {
          string: 'expires must be a string',
          required: 'expires is required',
        },
      },
      factory: faker => faker.number.int({ min: 1000, max: 10000 }),
    },
    status: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.lines(1),
    },
    image: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'image must be a string',
        },
      },
      factory: faker => faker.image.url(),
    },
    providerId: {
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          string: 'provider_id must be a string',
        },
      },
      factory: faker => faker.string.alphanumeric(10),
    },
  },
} satisfies Model
