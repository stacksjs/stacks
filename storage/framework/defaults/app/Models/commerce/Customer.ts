import type { Attributes } from '@stacksjs/types'
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Customer',
  table: 'customers',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    gdpr: { erasure: 'anonymize', basis: 'contract', purpose: 'Customer record behind orders and payments' },
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
      middleware: ['auth'],
    },

    observe: true,
  },

  hasMany: ['Order', 'GiftCard', 'Review', 'Payment', 'LicenseKey', 'WaitlistProduct', 'WaitlistRestaurant'],
  belongsTo: ['User'],

  attributes: {
    name: {
      personal: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().min(2).max(255),
        message: {
          min: 'Name must have a minimum of 2 characters',
          max: 'Name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.person.fullName(),
    },

    email: {
      personal: true,
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

    phone: {
      personal: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(50),
        message: {
          max: 'Phone number must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.phone.number(),
    },

    totalSpent: {
      default: 0,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Total spent cannot be negative',
        },
      },
      // Integer minor units: $0 to $5,000.
      factory: faker => faker.number.int({ min: 0, max: 500000 }),
    },

    lastOrder: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.date.recent({ days: 60 }).toISOString().split('T')[0],
    },

    status: {
      default: 'Active',
      order: 7,
      fillable: true,
      validation: {
        rule: schema.enum(['Active', 'Inactive']).required(),
        message: {
          enum: 'Status must be either Active or Inactive',
        },
      },
      factory: faker => faker.helpers.arrayElement(['Active', 'Inactive']),
    },

    avatar: {
      personal: true,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string().required().url(),
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
} as const)
