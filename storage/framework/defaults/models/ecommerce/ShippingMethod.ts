import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'ShippingMethod',
  table: 'shipping_methods',
  primaryKey: 'id',
  autoIncrement: false, // Using UUID instead of auto-increment

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'base_rate', 'free_shipping', 'status'],
      searchable: ['name', 'description'],
      sortable: ['name', 'base_rate', 'created_at', 'updated_at'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'shipping-methods',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },

    observe: true,
  },

  hasOne: ['ShippingZone'],

  attributes: {
    name: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    description: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(500),
        message: {
          maxLength: 'Description must have a maximum of 500 characters',
        },
      },
      factory: faker => faker.lorem.paragraph(),
    },

    base_rate: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Base rate cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 500, max: 5000 }), // 5.00 to 50.00
    },

    free_shipping: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().nullable(),
      },
      factory: (faker) => {
        // 30% chance of being null (N/A), otherwise a minimum order amount
        return faker.datatype.boolean({ probability: 0.3 })
          ? null
          : faker.number.int({ min: 5000, max: 20000 }) // 50.00 to 200.00
      },
    },

    status: {
      required: true,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive', 'draft']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive', 'draft']),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
