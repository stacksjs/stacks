import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Manufacturer',
  table: 'manufacturers',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'manufacturer', 'description', 'country', 'featured'],
      searchable: ['manufacturer', 'description', 'country'],
      sortable: ['manufacturer', 'country', 'createdAt', 'updatedAt'],
      filterable: ['country', 'featured'],
    },

    useSeeder: {
      count: 30,
    },

    useApi: {
      uri: 'product-manufacturers',
    },

    observe: true,
  },

  hasMany: ['Product'],

  attributes: {
    manufacturer: {
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Manufacturer name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.company.name(),
    },

    description: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(2000),
        message: {
          max: 'Description must have a maximum of 2000 characters',
        },
      },
      factory: faker => `${faker.company.catchPhrase()}. ${faker.company.buzzPhrase()}`,
    },

    country: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Country must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.location.country(),
    },

    featured: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.2 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
