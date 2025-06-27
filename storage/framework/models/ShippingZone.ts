import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'ShippingZone',
  table: 'shipping_zones',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'countries', 'regions', 'postalCodes', 'status'],
      searchable: ['name'],
      sortable: ['name', 'createdAt', 'updatedAt'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'shipping-zones',
    },

    observe: true,
  },

  belongsTo: ['ShippingMethod'],
  hasMany: ['ShippingRate'],
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
      factory: faker => `${faker.location.country()} Zone`,
    },

    countries: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(1000),
        message: {
          max: 'Countries must have a maximum of 1000 characters',
        },
      },
      factory: (faker) => {
        const countriesCount = faker.number.int({ min: 1, max: 5 })
        const countries = Array.from({ length: countriesCount }, () => faker.location.country())
        return JSON.stringify(countries)
      },
    },

    regions: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
        message: {
          max: 'Regions must have a maximum of 500 characters',
        },
      },
      factory: (faker) => {
        const continents = ['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica']
        const regionsCount = faker.number.int({ min: 0, max: 3 })
        const regions = faker.helpers.arrayElements(continents, regionsCount)
        return JSON.stringify(regions)
      },
    },

    postalCodes: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().max(1000),
        message: {
          max: 'Postal codes must have a maximum of 1000 characters',
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
      order: 6,
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
