import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'ShippingRate',
  table: 'shipping_rates',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'method', 'zone', 'weight_from', 'weight_to', 'rate'],
      searchable: ['method', 'zone'],
      sortable: ['method', 'zone', 'weight_from', 'weight_to', 'rate', 'created_at', 'updated_at'],
      filterable: ['method', 'zone'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'shipping-rates',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },

    observe: true,
  },

  attributes: {
    method: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'Method must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    zone: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'Zone must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.location.country(),
    },

    weight_from: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Weight from cannot be negative',
        },
      },
      factory: faker => faker.number.float({ min: 0, max: 10, fractionDigits: 2 }),
    },

    weight_to: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Weight to cannot be negative',
        },
      },
      factory: faker => faker.number.float({ min: 10, max: 50, fractionDigits: 2 }),
    },

    rate: {
      required: true,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Rate cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 500, max: 5000 }), // 5.00 to 50.00
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
