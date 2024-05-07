import { faker } from '@stacksjs/faker'
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Subscriber', // defaults to the sanitized file name
  table: 'subscribers', // defaults to the lowercase, plural name of the model
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true
  // highlight: 2,

  traits: {
    useTimestamps: true, // defaults to true
    useSeeder: {
      // defaults to a count of 10
      count: 10,
    },
  },

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
    },
  },
} satisfies Model
