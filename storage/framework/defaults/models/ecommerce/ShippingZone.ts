import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'ShippingZone',
  table: 'shipping_zones',
  primaryKey: 'id',
  autoIncrement: false, // Using UUID instead of auto-increment

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'countries', 'regions', 'postal_codes', 'status'],
      searchable: ['name'],
      sortable: ['name', 'created_at', 'updated_at'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'shipping-zones',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },

    observe: true,
  },

  belongsTo: ['ShippingMethod'],

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
      factory: faker => `${faker.location.country()} Zone`,
    },

    countries: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(1000),
        message: {
          maxLength: 'Countries must have a maximum of 1000 characters',
        },
      },
      factory: (faker) => {
        const countriesCount = faker.number.int({ min: 1, max: 5 })
        const countries = Array.from({ length: countriesCount }, () => faker.location.country())
        return JSON.stringify(countries)
      },
    },

    regions: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(500),
        message: {
          maxLength: 'Regions must have a maximum of 500 characters',
        },
      },
      factory: (faker) => {
        const continents = ['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica']
        const regionsCount = faker.number.int({ min: 0, max: 3 })
        const regions = faker.helpers.arrayElements(continents, regionsCount)
        return JSON.stringify(regions)
      },
    },

    postal_codes: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(1000),
        message: {
          maxLength: 'Postal codes must have a maximum of 1000 characters',
        },
      },
      factory: (faker) => {
        const codesCount = faker.number.int({ min: 0, max: 10 })
        // Generate postal/zip codes in various formats
        const codes = Array.from({ length: codesCount }, () => {
          return faker.location.zipCode()
        })
        return JSON.stringify(codes)
      },
    },

    status: {
      required: true,
      order: 6,
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
