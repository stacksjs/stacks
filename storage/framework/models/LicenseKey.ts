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
      displayable: ['id', 'key', 'template', 'expiry_date', 'status'],
      searchable: ['key'],
      sortable: ['template', 'expiry_date', 'status', 'created_at', 'updated_at'],
      filterable: ['status', 'template'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'license-keys',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },

    observe: true,
  },

  belongsTo: ['Customer', 'Product', 'Order'],

  attributes: {
    key: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string(),
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
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.enum(['Standard License', 'Premium License', 'Enterprise License'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['Standard License', 'Premium License', 'Enterprise License']),
    },

    expiry_date: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: faker => faker.date.future().toISOString(),
    },

    status: {
      default: 'unassigned',
      order: 4,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive', 'unassigned'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive', 'unassigned']),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
