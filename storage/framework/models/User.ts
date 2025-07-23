import type { Attributes, Model } from '@stacksjs/types'
import { makeHash } from '@stacksjs/security'
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
  ],

  traits: {
    useAuth: {
      usePasskey: true,
    },
    useUuid: true,
    useTimestamps: true, // defaults to true, `timestampable` used as an alias
    useSocials: ['github'],
    useSearch: {
      displayable: ['id', 'name', 'email'], // the fields to become d (defaults to all fields)
      searchable: ['name', 'email'], // the fields to become searchable (defaults to all fields)
      sortable: ['created_at', 'updated_at'], // the fields to become sortable (defaults to all fields)
      filterable: [], // the fields to become filterable (defaults to all fields)
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
  },

  hasOne: ['Subscriber', 'Driver', 'Author'],

  // hasMany: [
  //   'PersonalAccessToken',
  //   'OauthAccessToken',
  //   'Customer',
  // ],


  attributes: {
    name: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().min(5).max(100),
        message: {
          min: 'Name must have a minimum of 3 characters',
          max: 'Name must have a maximum of 255 characters',
        },
      },

      factory: faker => faker.person.fullName(),
    },

    email: {
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().email().required(),
        message: {
          required: 'Email is required',
          email: 'Email must be a valid email address',
        },
      },

      factory: faker => faker.internet.email(),
    },
    password: {
      order: 3,
      hidden: true,
      fillable: true,
      validation: {
        rule: schema.string().required().min(6).max(255),
        message: {
          required: 'Password is required',
          min: 'Password must have a minimum of 6 characters',
          max: 'Password must have a maximum of 255 characters',
        },
      },

      factory: () => '123456',
    },
  },
  get: {
    salutationName: (attributes: Attributes) => {
      return `Mr. ${attributes.name}`
    },
  },

  set: {
    password: async (attributes: Attributes) => {
      return await makeHash(attributes.password, { algorithm: 'bcrypt' })
    },
  },
  dashboard: {
    highlight: true,
  },
} satisfies Model
