import type { Attributes, Model } from '@stacksjs/types'
// soon, these will be auto-imported
import { schema } from '@stacksjs/validation'

export default {
  name: 'User', // defaults to the sanitized file name
  table: 'users', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  // Define composite indexes
  indexes: [
    {
      name: 'users_email_name_index',
      columns: ['email', 'name'],
    },
    {
      name: 'users_job_title_status_index',
      columns: ['job_title', 'created_at'],
    },
  ],

  traits: {
    useAuth: {
      usePasskey: true,
    },
    useUuid: true,
    useTimestamps: true, // defaults to true, `timestampable` used as an alias
    useSearch: {
      displayable: ['id', 'job_title', 'name', 'email'], // the fields to become d (defaults to all fields)
      searchable: ['job_title', 'name', 'email'], // the fields to become searchable (defaults to all fields)
      sortable: ['created_at', 'updated_at'], // the fields to become sortable (defaults to all fields)
      filterable: ['job_title'], // the fields to become filterable (defaults to all fields)
      // options: {}, // you may pass options to the search engine
    },

    useSeeder: {
      // defaults to a count of 10, `seedable` used as an alias
      count: 10,
    },

    useApi: {
      uri: 'users', // your-url.com/api/users

      routes: ['index', 'store', 'show'],
    },

    observe: true,
  },

  hasOne: ['Subscriber', 'Driver', 'Author'],
  hasMany: ['Deployment', 'Subscription', 'PaymentMethod', 'PaymentTransaction', 'Customer'],

  belongsToMany: ['Team'],

  attributes: {
    name: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().min(5).max(255),
        message: {
          min: 'Name must have a minimum of 3 characters',
          max: 'Name must have a maximum of 255 characters',
        },
      },

      factory: faker => faker.person.fullName(),
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

      factory: faker => faker.internet.email(),
    },

    jobTitle: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().min(3).max(255),
        message: {
          min: 'Job title must have a minimum of 3 characters',
          max: 'Job title must have a maximum of 255 characters',
        },
      },

      factory: faker => faker.person.jobTitle(),
    },
    password: {
      required: true,
      order: 3,
      hidden: true,
      fillable: true,
      validation: {
        rule: schema.string().min(6).max(255),
        message: {
          min: 'Password must have a minimum of 6 characters',
          max: 'Password must have a maximum of 255 characters',
        },
      },

      factory: faker => faker.internet.password(),
    },
  },
  get: {
    salutationName: (attributes: Attributes) => {
      return `Mr. ${attributes.name}`
    },
  },

  set: {
    password: (attributes: Attributes) => Bun.password.hash(String(attributes.password)),
  },
  dashboard: {
    highlight: true,
  },
} satisfies Model
