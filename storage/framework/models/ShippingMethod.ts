import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'ShippingMethod',
  table: 'shipping_methods',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'baseRate', 'freeShipping', 'status'],
      searchable: ['name', 'description'],
      sortable: ['name', 'baseRate', 'createdAt', 'updatedAt'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'shipping-methods',
    },

    observe: true,
  },

  hasMany: ['ShippingZone', 'ShippingRate'],

  attributes: {
    name: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    description: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
        message: {
          max: 'Description must have a maximum of 500 characters',
        },
      },
      factory: faker => faker.lorem.paragraph(),
    },

    baseRate: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
        message: {
          min: 'Base rate cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 500, max: 5000 }), // 5.00 to 50.00
    },

    freeShipping: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: (faker) => {
        // 30% chance of being null (N/A), otherwise a minimum order amount
        return faker.datatype.boolean({ probability: 0.3 })
          ? null
          : faker.number.int({ min: 5000, max: 20000 }) // 50.00 to 200.00
      },
    },

    status: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive', 'draft']).required(),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive', 'draft']),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
