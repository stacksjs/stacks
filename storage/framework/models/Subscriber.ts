import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Subscriber', // defaults to the sanitized file name
  table: 'subscribers', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  traits: {
    useTimestamps: true, // defaults to true
    useSeeder: {
      // defaults to a count of 10
      count: 10,
    },
  },

  attributes: {
    subscribed: {
      fillable: true,
      validation: {
        rule: schema.boolean().required(),
        message: {
          boolean: 'subscribed must be a boolean',
          required: 'subscribed is required',
        },
      },

      factory: faker => faker.datatype.boolean(),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
