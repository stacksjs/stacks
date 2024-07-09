// soon, these will be auto-imported
import { faker } from '@stacksjs/faker'
import { capitalize } from '@stacksjs/strings'
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'
import type { User } from 'actions/src/orm/user'

export default {
  name: 'User', // defaults to the sanitized file name
  table: 'users', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  traits: {
    useAuth: {
      useTwoFactor: true,
    },
    useTimestamps: true, // defaults to true, `timestampable` used as an alias
    useSoftDeletes: true, // defaults to false, `softDeletable` used as an alias
    useSearch: {
      // defaults to true, `searchable` used as an alias
      searchable: ['name', 'email'], // the fields to become searchable (defaults to all fields)
      sortable: ['created_at', 'updated_at'], // the fields to become sortable (defaults to all fields)
      filterable: ['job_title'], // the fields to become filterable (defaults to all fields)
      // options: {}, // you may pass options to the search engine
    },

    useSeeder: {
      // defaults to a count of 10, `seedable` used as an alias
      count: 100,
    },

    useApi: {
      uri: 'users', // your-url.com/api/users
      middleware: ['Api'], // defaults to `[]`
      routes: ['index', 'update', 'store', 'destroy', 'show'],
    },

    // useUuid: true, // defaults to false
  },

  hasOne: ['Post', 'Subscriber'],
  hasMany: ['Deployment'],

  attributes: {
    name: {
      required: true,
      order: 3,

      validation: {
        rule: schema.string().minLength(3).maxLength(88),
        message: {
          minLength: 'Name must have a minimum of 3 characters',
          maxLength: 'Name must have a maximum of 255 characters',
        },
      },

      factory: () => faker.person.fullName(),
    },

    email: {
      unique: true,
      required: true,
      order: 1,
      validation: {
        rule: schema.string().email(),
        message: {
          email: 'Email must be a valid email address',
        },
      },

      factory: () => faker.internet.email(),
    },

    jobTitle: {
      required: true,
      order: 5,
      validation: {
        rule: schema.string().minLength(3).maxLength(255),
        message: {
          minLength: 'Job title must have a minimum of 3 characters',
          maxLength: 'Job title must have a maximum of 255 characters',
        },
      },

      factory: () => faker.person.jobTitle(),
    },
    password: {
      required: true,
      order: 2,
      hidden: true,
      validation: {
        rule: schema.string().minLength(6).maxLength(255),
        message: {
          minLength: 'Password must have a minimum of 6 characters',
          maxLength: 'Password must have a maximum of 255 characters',
        },
      },

      factory: () => faker.internet.password(),
    },
  },

  get: {
    fullName: (user: User) => capitalize(user.name),
  },

  set: {
    password: (password: string) => Bun.password.hash(password),
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
