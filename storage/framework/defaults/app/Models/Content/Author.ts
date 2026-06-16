import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Author', // defaults to the sanitized file name
  table: 'authors', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  // Define composite indexes
  indexes: [
    {
      name: 'authors_email_name_index',
      columns: ['email', 'name'],
    },
  ],

  traits: {
    useAuth: {
      usePasskey: true,
    },
    useUuid: true,
    useTimestamps: true, // defaults to true, `timestampable` used as an alias
    useSearch: {
      displayable: ['id', 'name', 'email'], // the fields to become d (defaults to all fields)
      searchable: ['name', 'email'], // the fields to become searchable (defaults to all fields)
      sortable: ['created_at', 'updated_at'], // the fields to become sortable (defaults to all fields)
      filterable: [],
    },

    // No faker seeding. Blog authorship lives in markdown frontmatter
    // (content/blog/*.md); this model backs the CMS dashboard only.

    useApi: {
      uri: 'authors',

      routes: ['index', 'store', 'show'],
    },

    observe: true,
  },

  hasMany: ['Post'],
  belongsTo: ['User'],

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().min(5).max(255),
        message: {
          min: 'Name must have a minimum of 3 characters',
          max: 'Name must have a maximum of 255 characters',
        },
      },

      factory: faker => faker.person.fullName(),
    },

    email: {
      unique: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().email(),
        message: {
          email: 'Email must be a valid email address',
        },
      },

      factory: faker => faker.internet.email(),
    },

    bio: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
        message: {
          max: 'Bio must have a maximum of 500 characters',
        },
      },
      factory: faker => faker.lorem.sentence(),
    },

    avatar: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().url(),
        message: {
          url: 'Avatar must be a valid URL',
        },
      },
      factory: faker => faker.image.avatar(),
    },
  },
  dashboard: {
    highlight: true,
  },
} as const)
