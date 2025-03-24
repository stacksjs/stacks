import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'DigitalDelivery',
  table: 'digital_deliveries',
  primaryKey: 'id',
  autoIncrement: false, // Using UUID instead of auto-increment

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'download_limit', 'expiry_days', 'status'],
      searchable: ['name', 'description'],
      sortable: ['name', 'download_limit', 'expiry_days', 'status', 'created_at', 'updated_at'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'digital-deliveries',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },

    observe: true,
  },

  attributes: {
    name: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'Name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    description: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.commerce.productDescription(),
    },

    download_limit: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },

    expiry_days: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 365 }),
    },

    requires_login: {
      default: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean(),
    },

    automatic_delivery: {
      default: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean(),
    },

    status: {
      default: 'active',
      order: 8,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive']),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
