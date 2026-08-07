import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Driver',
  table: 'drivers',
  primaryKey: 'id',
  autoIncrement: true,

  belongsTo: ['User'],
  hasMany: ['DeliveryRoute', 'DriverPing'],

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
      middleware: ['auth'],
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
        rule: schema.enum(['active', 'on_delivery', 'on_break', 'offline']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'on_delivery', 'on_break']),
    },

    /*
     * Last known position.
     *
     * Denormalised from the `driver_pings` series on purpose: "where is this
     * driver right now" is asked on every map frame and by every tracking
     * page, and answering it with a MAX(recorded_at) subquery over a table
     * that grows by a row every few seconds is the wrong shape. The series is
     * the history; these three columns are the present.
     */
    latitude: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(-90).max(90),
        message: {
          min: 'Latitude must be between -90 and 90',
          max: 'Latitude must be between -90 and 90',
        },
      },
      factory: faker => faker.location.latitude(),
    },

    longitude: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(-180).max(180),
        message: {
          min: 'Longitude must be between -180 and 180',
          max: 'Longitude must be between -180 and 180',
        },
      },
      factory: faker => faker.location.longitude(),
    },

    /** Degrees clockwise from true north, so a map can rotate the marker. */
    heading: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(360),
      },
      factory: faker => faker.number.int({ min: 0, max: 359 }),
    },

    /** Metres per second, as reported by the device. */
    speed: {
      order: 9,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: () => 0,
    },

    /*
     * When the last fix landed. A tracking map needs this to say "updated 4
     * seconds ago" and, more importantly, to stop claiming a driver is at a
     * position that is ten minutes stale.
     */
    lastPingAt: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => new Date().toISOString(),
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
