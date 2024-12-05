import type { Model } from '@stacksjs/types'
import { collect } from '@stacksjs/collections'
import { faker } from '@stacksjs/faker'

import { schema } from '@stacksjs/validation'

export default {
  name: 'PaymentMethod', // defaults to the sanitized file name
  table: 'payment_methods', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true
  belongsTo: ['User'],
  traits: {
    useUuid: true,
  },
  attributes: {
    type: {
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
      factory: () => faker.string.numeric(4),
    },

    brand: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(50),
        message: {
          number: 'brand must be a number',
          required: 'brand is required',
        },
      },
      factory: () => collect(['visa', 'mastercard', 'amex', 'jcb']).random().first(),
    },

    expires: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          string: 'expires must be a string',
          required: 'expires is required',
        },
      },
      factory: () => faker.date.anytime().toDateString(),
    },

    providerId: {
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          string: 'unit_price must be a number',
          required: 'unit_price is required',
        },
      },
      factory: () => faker.string.alphanumeric(10),
    },
  },
} satisfies Model
