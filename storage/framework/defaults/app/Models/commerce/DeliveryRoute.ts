import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'DeliveryRoute',
  table: 'delivery_routes',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'driver', 'vehicle', 'stops', 'deliveryTime', 'totalDistance', 'lastActive'],
      searchable: ['driver', 'vehicle'],
      sortable: ['stops', 'deliveryTime', 'totalDistance', 'lastActive', 'createdAt', 'updatedAt'],
      filterable: ['driver', 'vehicle'],
    },

    useSeeder: {
      count: 5,
    },

    useApi: {
      uri: 'delivery-routes',
      middleware: ['auth'],
    },

    observe: true,
  },

  belongsTo: ['Driver'],
  hasMany: ['DeliveryStop', 'DriverPing'],

  attributes: {
    driver: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
      },
      factory: faker => faker.person.fullName(),
    },

    vehicle: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
      },
      factory: faker => faker.vehicle.vehicle(),
    },

    stops: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
      },
      factory: faker => faker.number.int({ min: 1, max: 20 }),
    },

    deliveryTime: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
      },
      factory: faker => faker.number.int({ min: 30, max: 480 }), // 30 minutes to 8 hours
    },

    totalDistance: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
      },
      factory: faker => faker.number.int({ min: 5, max: 200 }), // 5 to 200 miles
    },

    lastActive: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.unix().required(),
      },
      factory: faker => faker.date.recent().getTime(),
    },

    /*
     * Route lifecycle. `stops` and `totalDistance` describe a route that has
     * already run; a route being followed right now needs to say so, because
     * that is the difference between a tracking map that draws a moving
     * vehicle and one that draws yesterday's.
     */
    status: {
      order: 7,
      fillable: true,
      default: 'planned',
      validation: {
        rule: schema.enum(['planned', 'active', 'completed', 'cancelled']),
        message: {
          enum: 'Status must be one of: planned, active, completed, cancelled',
        },
      },
      factory: faker => faker.helpers.arrayElement(['planned', 'active', 'completed']),
    },

    startedAt: {
      order: 8,
      fillable: true,
      validation: { rule: schema.timestamp() },
      factory: () => null,
    },

    completedAt: {
      order: 9,
      fillable: true,
      validation: { rule: schema.timestamp() },
      factory: () => null,
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
