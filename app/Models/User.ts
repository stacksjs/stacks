// soon, these will be auto-imported
import { faker } from '@stacksjs/faker'
import type { UserType as User } from '@stacksjs/orm'
import { capitalize } from '@stacksjs/strings'
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'
import Post from './Post'
import Subscriber from './Subscriber'

export default {
  name: 'User', // defaults to the sanitized file name
  table: 'users', // defaults to the lowercase, plural name of the model name
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  traits: {
    useAuth: true, // defaults to false, `authenticatable` used as an alias
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
      count: 1000,
    },

    useApi: {
      uri: 'users', // your-url.com/api/users
      middleware: ['auth'], // defaults to `[]`
      routes: ['index', 'update', 'store', 'destroy', 'show'],
    },

    // useUuid: true, // defaults to false
  },

  hasMany: [
    {
      model: 'Post',
    },
  ],

  hasOne: [
    {
      model: 'Subscriber',
    },
  ],

  attributes: {
    name: {
      validator: {
        rule: schema.string().minLength(3).maxLength(255),
        message: 'Name must be between 3 and 255 characters',
      },

      factory: () => faker.person.fullName(),
    },

    email: {
      unique: true,
      validator: {
        rule: schema.string().email(),
        message: 'Email must be a valid email address',
      },

      factory: () => faker.internet.email(),
    },

    jobTitle: {
      validator: {
        rule: schema.string().minLength(3).maxLength(255),
        message: 'Job title must be between 3 and 255 characters',
      },

      factory: () => faker.person.jobTitle(),
    },

    password: {
      validator: {
        rule: schema.string().minLength(6).maxLength(255),
        message: 'Password must be between 6 and 255 characters',
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
