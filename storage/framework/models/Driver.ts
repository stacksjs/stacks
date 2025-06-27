import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Driver',
  table: 'drivers',
  primaryKey: 'id',
  autoIncrement: true,

  belongsTo: ['User'],
  hasMany: ['DeliveryRoute'],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'phone', 'vehicleNumber', 'license', 'status'],
      searchable: ['name', 'phone', 'vehicleNumber', 'license'],
      sortable: ['name', 'status', 'createdAt', 'updatedAt'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'drivers',
    },

    observe: true,
  },

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          max: 'Name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.person.fullName(),
    },

    phone: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          max: 'Phone number must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.phone.number(),
    },

    vehicleNumber: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          max: 'Vehicle number must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.vehicle.vrm(),
    },

    license: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          max: 'License number must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.string.alphanumeric({ length: 10, casing: 'upper' }),
    },

    status: {
      default: 'active',
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'on_delivery', 'on_break']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'on_delivery', 'on_break']),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
