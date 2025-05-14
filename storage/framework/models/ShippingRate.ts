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
      displayable: ['id', 'method', 'zone', 'weightFrom', 'weightTo', 'rate'],
      searchable: ['method', 'zone'],
      sortable: ['method', 'zone', 'weightFrom', 'weightTo', 'rate', 'createdAt', 'updatedAt'],
      filterable: ['method', 'zone'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'shipping-rates',
    },

    observe: true,
  },

  attributes: {
    method: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          max: 'Method must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    zone: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          max: 'Zone must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.location.country(),
    },

    weightFrom: {
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

    weightTo: {
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
