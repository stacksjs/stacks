import type { Model } from '@stacksjs/types'
import { collect } from '@stacksjs/collections'

import { schema } from '@stacksjs/validation'

export default {
  name: 'PaymentMethod', // defaults to the sanitized file name
  table: 'payment_methods', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true
  belongsTo: ['User'],
  hasMany: ['PaymentTransaction'],
  traits: {
    useSeeder: {
      count: 5,
    },
    useUuid: true,
  },
  attributes: {
    type: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(512),
        message: {
          string: 'type must be a string',
          required: 'type is required',
          max: 'type must have a maximum of 512 characters',
        },
      },
      factory: () => 'card',
    },

    lastFour: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'last_four must be a number',
          required: 'last_four is required',
        },
      },
      factory: faker => faker.string.numeric(4),
    },

    brand: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(50),
        message: {
          number: 'brand must be a number',
          required: 'brand is required',
        },
      },
      factory: () => collect(['visa', 'mastercard', 'amex', 'jcb']).random().first(),
    },

    expMonth: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          string: 'exp_month must be a number',
          required: 'exp_month is required',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 12 }),
    },

    expYear: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          string: 'exp_year must be a number',
          required: 'exp_year is required',
        },
      },
      factory: faker => faker.number.int({ min: 2024, max: 2050 }),
    },
    isDefault: {
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
    },
    providerId: {
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          string: 'provider_id must be a string',
          required: 'provider_id is required',
        },
      },
      factory: faker => faker.string.alphanumeric(10),
    },
  },
} satisfies Model
