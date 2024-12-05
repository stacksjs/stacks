import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'
import { schema } from '@stacksjs/validation'

export default {
  name: 'PaymenMethod', // defaults to the sanitized file name
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
      factory: () => faker.string.numeric,
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
    },
  },
} satisfies Model
