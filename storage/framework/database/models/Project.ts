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
      validation: {
        rule: schema.string(),
        message: {
          string: 'name must be a string',
          required: 'name is required',
        },
      },

      factory: () => faker.lorem.sentence({ min: 3, max: 6 }),
    },

    description: {
      validation: {
        rule: schema.string(),
        message: {
          string: 'description must be a string',
          required: 'description is required',
        },
      },

      factory: () => faker.lorem.sentence({ min: 10, max: 25 }),
    },

    url: {
      validation: {
        rule: schema.string(),
        message: {
          string: 'url must be a string',
          required: 'url is required',
        },
      },

      factory: () => faker.internet.url(),
    },

    status: {
      validation: {
        rule: schema.string(),
        message: {
          string: 'status must be a string',
          required: 'status is required',
        },
      },

      factory: () => collect(['active', 'inactive']).random(),
    },
  },
} satisfies Model
