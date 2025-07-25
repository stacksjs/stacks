import type { Model } from '@stacksjs/types'
import { collect } from '@stacksjs/collections'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Team', // defaults to the sanitized file name
  table: 'teams', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  hasMany: ['PersonalAccessToken'],

  traits: {
    useTimestamps: true, // defaults to true
    useSeeder: {
      // defaults to a count of 10
      count: 10,
    },
  },

  attributes: {
    name: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          string: 'name must be a string',
          required: 'name is required',
        },
      },

      factory: faker => faker.lorem.sentence({ min: 3, max: 6 }),
    },

    companyName: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          string: 'companyName must be a string',
          required: 'companyName is required',
        },
      },

      factory: faker => faker.company.name(),
    },

    email: {
      fillable: true,
      validation: {
        rule: schema.string().required().email(),
        message: {
          email: 'email must be valid',
          required: 'email is required',
        },
      },

      factory: faker => faker.internet.email(),
    },

    billingEmail: {
      fillable: true,
      validation: {
        rule: schema.string().required().email(),
        message: {
          email: 'billingEmail must be a valid email',
          required: 'billingEmail is required',
        },
      },

      factory: faker => faker.internet.email(),
    },

    status: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          string: 'status must be a string',
          required: 'status is required',
        },
      },

      factory: () => collect(['deployed', 'inactive']).random().first(),
    },

    description: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          string: 'description must be a string',
          required: 'description is required',
        },
      },

      factory: faker => faker.lorem.sentence({ min: 10, max: 30 }),
    },

    path: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          string: 'path must be a string',
          required: 'path is required',
        },
      },

      factory: faker => `/Users/chrisbreuer/Code/${faker.lorem.words().toLowerCase().replace(/\s+/g, '-')}`,
    },

    isPersonal: {
      fillable: true,
      validation: {
        rule: schema.boolean().required(),
        message: {
          boolean: 'isPersonal must be a boolean',
          required: 'isPersonal is required',
        },
      },

      factory: faker => faker.datatype.boolean(),
    },
  },
} satisfies Model
