import type { Model } from '@stacksjs/types'
import type { UserModel } from '../../storage/framework/orm/src/models/User'
// soon, these will be auto-imported
import { faker } from '@stacksjs/faker'
import { capitalize } from '@stacksjs/strings'
import { schema } from '@stacksjs/validation'

export default {
  name: 'User', // defaults to the sanitized file name
  table: 'users', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  traits: {
    useAuth: {
      usePasskey: true,
    },
    useTimestamps: true, // defaults to true, `timestampable` used as an alias
    useSearch: {
      // defaults to true, `searchable` used as an alias
      searchable: ['job_title', 'name', 'email'], // the fields to become searchable (defaults to all fields)
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

      routes: ['index', 'store', 'show'],
    },

    observe: true,

    billable: true,

    // useUuid: true, // defaults to false
  },

  hasOne: ['Post', 'Subscriber'],
  hasMany: ['Deployment', 'Subscription'],

  belongsToMany: ['Team'],

  attributes: {
    name: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().minLength(5).maxLength(255),
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
      fillable: true,
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
      fillable: true,
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
      fillable: true,
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
    formalName: (user: UserModel) => {
      const name = user?.name as string
      const nameParts = name.split(' ')

      return `${capitalize(nameParts.pop()!)}, ${capitalize(nameParts.join(' '))}`
    },
  },

  set: {
    password: (password: string) => Bun.password.hash(password),
  },
  dashboard: {
    highlight: true,
  },
} satisfies Model
