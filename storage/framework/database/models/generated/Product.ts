import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Product', // defaults to the sanitized file name
  table: 'products', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true
  belongsTo: ['User'],
  traits: {
    useSeeder: {
      count: 10,
    },
    useUuid: true,
  },
  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(512),
        message: {
          string: 'type must be a string',
          required: 'type is required',
          maxLength: 'type must have a maximum of 512 characters',
        },
      },
      factory: () => faker.lorem.lines(1),
    },

    description: {
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'last_four must be a number',
          required: 'last_four is required',
        },
      },
      factory: () => faker.lorem.lines(3),
    },
    key: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'last_four must be a number',
          required: 'last_four is required',
        },
      },
      factory: () => faker.string.alphanumeric(5),
    },

    unitPrice: {
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          string: 'expires must be a string',
          required: 'expires is required',
        },
      },
      factory: () => faker.number.int({ min: 1000, max: 10000 }),
    },
    status: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => faker.lorem.lines(1),
    },
    image: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'image must be a string',
        },
      },
      factory: () => faker.image.url(),
    },
    providerId: {
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          string: 'provider_id must be a string',
        },
      },
      factory: () => faker.string.alphanumeric(10),
    },
  },
} satisfies Model
