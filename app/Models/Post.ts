import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Post', // defaults to the sanitized file name
  table: 'posts', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  traits: {
    useTimestamps: true, // defaults to true
    useSeeder: {
      // defaults to a count of 10
      count: 10,
    },
  },

  belongsTo: [
    {
      model: 'User',
    },
  ],

  attributes: {
    title: {
      fillable: true,
      required: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'title must be a string',
          required: 'title is required',
        },
      },

      factory: faker => faker.lorem.sentence({ min: 3, max: 6 }),
    },

    body: {
      fillable: true,
      required: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'body must be a string',
          required: 'body is required',
        },
      },
      factory: faker => faker.lorem.sentence({ min: 10, max: 10 }),
    },
  },
} satisfies Model
