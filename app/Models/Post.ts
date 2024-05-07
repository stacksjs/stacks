import { faker } from '@stacksjs/faker'
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Post', // defaults to the sanitized file name
  table: 'posts', // defaults to the lowercase, plural name of the model
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
    title: {
      validator: {
        rule: schema.string(),
        message: '`title` must be a string',
      },

      factory: () => faker.datatype.string(),
    },
    body: {
      validator: {
        rule: schema.string(),
        message: '`body` must be a string',
      },

      factory: () => faker.datatype.string(),
    },
    subscriber_id: {
      validator: {
        rule: schema.number(),
        message: '',
      },
    },
  },
} satisfies Model
