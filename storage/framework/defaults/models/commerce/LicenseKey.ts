import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'LicenseKey',
  table: 'license_keys',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'key', 'template', 'expiryDate', 'status'],
      searchable: ['key'],
      sortable: ['template', 'expiryDate', 'status', 'createdAt', 'updatedAt'],
      filterable: ['status', 'template'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'license-keys',
    },

    observe: true,
  },

  belongsTo: ['Customer', 'Product', 'Order'],

  attributes: {
    key: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          pattern: 'License key must be in the format XXXX-XXXX-XXXX-XXXX-XXXX',
        },
      },
      factory: (faker) => {
        const generateBlock = () => faker.string.alphanumeric({ length: 4, casing: 'upper' })
        return `${generateBlock()}-${generateBlock()}-${generateBlock()}-${generateBlock()}-${generateBlock()}`
      },
    },

    template: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.enum(['Standard License', 'Premium License', 'Enterprise License']).required(),
      },
      factory: faker => faker.helpers.arrayElement(['Standard License', 'Premium License', 'Enterprise License']),
    },

    expiryDate: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.timestamp().required(),
        message: {
          timestamp: 'Expiry date must be a valid timestamp',
        },
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    status: {
      default: 'unassigned',
      order: 4,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive', 'unassigned']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive', 'unassigned']),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
