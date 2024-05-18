import { collect } from '@stacksjs/collections'
import { faker } from '@stacksjs/faker'
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Team', // defaults to the sanitized file name
  table: 'teams', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  belongsToMany: ['AccessToken'],

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

    companyName: {
      validator: {
        rule: schema.string(),
        message: '`companyName` must be a string',
      },

      factory: () => faker.company.name(),
    },

    email: {
      validator: {
        rule: schema.string().email(),
        message: '`email` must be a string',
      },

      factory: () => faker.internet.email(),
    },

    billingEmail: {
      validator: {
        rule: schema.string().email(),
        message: '`billingEmail` must be a string',
      },

      factory: () => faker.internet.email(),
    },

    status: {
      validator: {
        rule: schema.string(),
        message: '`status` must be a string',
      },

      factory: () => collect(['deployed', 'inactive']).random(),
    },

    description: {
      validator: {
        rule: schema.string(),
        message: '`description` must be a string',
      },

      factory: () => faker.lorem.sentence({ min: 10, max: 30 }),
    },

    path: {
      validator: {
        rule: schema.string(),
        message: '`path` must be a string',
      },

      factory: () => `/Users/chrisbreuer/Code/${faker.lorem.words().toLowerCase().replace(/\s+/g, '-')}`,
    },

    isPersonal: {
      validator: {
        rule: schema.boolean(),
        message: '`isPersonal` must be a boolean',
      },

      factory: () => faker.datatype.boolean(),
    },
  },
} satisfies Model
