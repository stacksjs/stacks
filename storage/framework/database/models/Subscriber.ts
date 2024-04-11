import { faker } from '@stacksjs/faker'
import { schema } from '@stacksjs/validation'
import type { Model } from '@stacksjs/types'

export default {
  name: 'Subscriber', // defaults to the sanitized file name
  table: 'subscribers', // defaults to the lowercase, plural name of the model
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  traits: {
    useTimestamps: true, // defaults to true
    useSeeder: { // defaults to a count of 10
      count: 10,
    },
  },

  // relationships
  belongsTo: 'User',

  attributes: {
    subscribed: {
      validator: {
        rule: schema.boolean(),
        message: '`subscribed` must be a boolean',
      },

      factory: () => faker.datatype.boolean(),
    },
    user_id: {
      validator: {
        rule: schema.number(),
        message: '',
      },

      factory: () => faker.datatype.boolean(),
    },
  },
} satisfies Model
