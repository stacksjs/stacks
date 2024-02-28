import { faker } from '@stacksjs/faker'
import { validator } from '@stacksjs/validation'
import type { Model } from '@stacksjs/types'

export default {
  name: 'Subscriber',
  table: 'subscribers',
  // primaryKey: 'id', // defaults to `id`
  // autoIncrement: true, // defaults to true

  traits: {
    useSoftDeletes: true, // defaults to false
    useSeeder: { // defaults to a count of 10
      count: 10,
    },
  },

  belongsTo: 'User',

  fields: {
    subscribed: {
      validator: {
        rule: validator.boolean(),
        message: '`subscribed` must be a boolean',
      },

      factory: () => faker.random.boolean(),
    },
  },
} satisfies Model
