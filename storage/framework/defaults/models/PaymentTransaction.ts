import type { Model } from '@stacksjs/types'
import { collect } from '@stacksjs/collections'

import { schema } from '@stacksjs/validation'

export default {
  name: 'PaymentTransaction', // defaults to the sanitized file name
  table: 'payment_transactions', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true
  belongsTo: ['User', 'PaymentMethod'],
  traits: {
    useUuid: true,
    useSeeder: {
      count: 5,
    },
  },
  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          string: 'name must be a string',
          required: 'name is required',
          max: 'name must have a maximum of 255 characters',
        },
      },
      factory: () => 'Dashboard Subscription',
    },

    description: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'description must be a string',
        },
      },
      factory: faker => faker.lorem.lines(2),
    },

    amount: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'amount must be a number',
          required: 'amount is required',
        },
      },
      factory: faker => faker.number.int({ min: 1000, max: 10000 }),
    },

    type: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(50),
        message: {
          string: 'type must be a string',
          max: 'type must have a maximum of 512 characters',
        },
      },
      factory: () => collect(['one-time', 'subscription']).random().first(),
    },
    providerId: {
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          string: 'provider_id must be a number',
          required: 'provider_id is required',
        },
      },
      factory: faker => faker.string.alphanumeric(10),
    },
  },
} satisfies Model
