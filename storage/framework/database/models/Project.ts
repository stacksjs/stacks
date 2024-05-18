import { collect } from '@stacksjs/collections'
import { faker } from '@stacksjs/faker'
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Project', // defaults to the sanitized file name
  table: 'projects', // defaults to the lowercase, plural name of the model name (or the name of the model file)
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
    name: {
      validator: {
        rule: schema.string(),
        message: '`name` must be a string',
      },

      factory: () => faker.lorem.sentence({ min: 3, max: 6 }),
    },

    description: {
      validator: {
        rule: schema.string(),
        message: '`description` must be a string',
      },

      factory: () => faker.lorem.sentence({ min: 10, max: 10 }),
    },

    url: {
      validator: {
        rule: schema.string(),
        message: '`url` must be a string',
      },

      factory: () => faker.internet.url(),
    },

    status: {
      validator: {
        rule: schema.string(),
        message: '`status` must be a string',
      },

      factory: () => collect(['active', 'inactive']).random(),
    },
  },
} satisfies Model
