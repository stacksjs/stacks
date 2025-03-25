import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Driver',
  table: 'drivers',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'phone', 'vehicle_number', 'license', 'status'],
      searchable: ['name', 'phone', 'vehicle_number', 'license'],
      sortable: ['name', 'status', 'created_at', 'updated_at'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'drivers',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },

    observe: true,
  },

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'Name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.person.fullName(),
    },

    phone: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'Phone number must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.phone.number(),
    },

    vehicle_number: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'Vehicle number must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.vehicle.vrm(),
    },

    license: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'License number must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.string.alphanumeric({ length: 10, casing: 'upper' }),
    },

    status: {
      default: 'active',
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'on_delivery', 'on_break'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'on_delivery', 'on_break']),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
