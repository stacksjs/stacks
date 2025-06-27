import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
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
    },

    observe: true,
  },

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
        rule: schema.timestamp().required(),
      },
      factory: (faker) => {
        const date = faker.date.recent()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
