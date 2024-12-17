import type { Model } from '@stacksjs/types'
import { collect } from '@stacksjs/collections'
import { faker } from '@stacksjs/faker'

import { schema } from '@stacksjs/validation'

export default {
  name: 'Transaction', // defaults to the sanitized file name
  table: 'transactions', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true
  belongsTo: ['User'],
  traits: {
    useUuid: true,
  },
  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          string: 'name must be a string',
          required: 'name is required',
          maxLength: 'name must have a maximum of 255 characters',
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
      factory: () => faker.lorem.lines(2),
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
      factory: () => collect(['visa', 'mastercard', 'amex', 'jcb']).random().first(),
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

    type: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(50),
        message: {
          string: 'type must be a string',
          maxLength: 'type must have a maximum of 512 characters',
        },
      },
      factory: () => collect(['one-time', 'subscription']).random().first(),
    },
    providerId: {
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          string: 'provider_id must be a number',
          required: 'provider_id is required',
        },
      },
      factory: () => faker.string.alphanumeric(10),
    },
  },
} satisfies Model
