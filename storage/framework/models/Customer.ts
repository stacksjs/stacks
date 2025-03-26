import type { Attributes, Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Customer',
  table: 'customers',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'email', 'phone', 'status'],
      searchable: ['name', 'email', 'phone'],
      sortable: ['name', 'totalSpent', 'lastOrder', 'created_at', 'updated_at'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 20,
    },

    useApi: {
      uri: 'customers',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },

    observe: true,
  },

  hasMany: ['Order', 'GiftCard', 'Review', 'Payment', 'LicenseKey', 'WaitlistProduct'],
  belongsTo: ['User'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().minLength(2).maxLength(255),
        message: {
          minLength: 'Name must have a minimum of 2 characters',
          maxLength: 'Name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.person.fullName(),
    },

    email: {
      unique: true,
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().email(),
        message: {
          email: 'Email must be a valid email address',
        },
      },
      factory: faker => faker.internet.email(),
    },

    phone: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().minLength(10).maxLength(20),
        message: {
          minLength: 'Phone number must have a minimum of 10 characters',
          maxLength: 'Phone number must have a maximum of 20 characters',
        },
      },
      factory: faker => faker.phone.number(),
    },

    totalSpent: {
      required: false,
      default: 0,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Total spent cannot be negative',
        },
      },
      factory: faker => faker.number.float({ min: 0, max: 2000 }),
    },

    lastOrder: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.date.recent({ days: 60 }).toISOString().split('T')[0],
    },

    status: {
      required: true,
      default: 'Active',
      order: 7,
      fillable: true,
      validation: {
        rule: schema.enum(['Active', 'Inactive']),
        message: {
          enum: 'Status must be either Active or Inactive',
        },
      },
      factory: faker => faker.helpers.arrayElement(['Active', 'Inactive']),
    },

    avatar: {
      required: false,
      order: 8,
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

  get: {
    fullContactInfo: (attributes: Attributes) => {
      return `${attributes.name} (${attributes.email}, ${attributes.phone})`
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
