import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'DigitalDelivery',
  table: 'digital_deliveries',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'downloadLimit', 'expiryDays', 'status'],
      searchable: ['name', 'description'],
      sortable: ['name', 'downloadLimit', 'expiryDays', 'status', 'createdAt', 'updatedAt'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'digital-deliveries',
    },

    observe: true,
  },

  attributes: {
    name: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          max: 'Name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    description: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.commerce.productDescription(),
    },

    downloadLimit: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },

    expiryDays: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().required(),
      },
      factory: faker => faker.number.int({ min: 1, max: 365 }),
    },

    requiresLogin: {
      default: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean(),
    },

    automaticDelivery: {
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
        rule: schema.enum(['active', 'inactive']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive']),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
