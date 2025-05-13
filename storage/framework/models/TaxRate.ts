import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'TaxRate',
  table: 'tax_rates',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'rate', 'type', 'country', 'region', 'status', 'isDefault'],
      searchable: ['name', 'country', 'region'],
      sortable: ['name', 'rate', 'status', 'createdAt', 'updatedAt'],
      filterable: ['status', 'isDefault'],
    },

    useSeeder: {
      count: 5,
    },

    useApi: {
      uri: 'tax-rates',
    },

    observe: true,
  },

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          maxLength: 'Name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    rate: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
        message: {
          min: 'Rate must be greater than or equal to 0',
          max: 'Rate must be less than or equal to 100',
        },
      },
      factory: faker => faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
    },

    type: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          maxLength: 'Type must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement(['VAT', 'GST', 'Sales Tax', 'Customs Duty']),
    },

    country: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          maxLength: 'Country must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.location.country(),
    },

    region: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica']),
    },

    status: {
      default: 'active',
      order: 6,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive']),
    },

    isDefault: {
      default: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean(),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
