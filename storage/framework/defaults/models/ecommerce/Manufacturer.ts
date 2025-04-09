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
      required: true,
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Manufacturer name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.company.name(),
    },

    description: {
      required: false,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(2000),
        message: {
          maxLength: 'Description must have a maximum of 2000 characters',
        },
      },
      factory: faker => `${faker.company.catchPhrase()}. ${faker.company.buzzPhrase()}`,
    },

    country: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Country must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.location.country(),
    },

    featured: {
      required: false,
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
