import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'WaitlistRestaurant',
  table: 'waitlist_restaurants',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['Customer'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'email', 'phone', 'partySize', 'checkInTime', 'tablePreference', 'status', 'quotedWaitTime', 'actualWaitTime', 'queuePosition'],
      searchable: ['name', 'email', 'phone'],
      sortable: ['name', 'partySize', 'checkInTime', 'createdAt', 'updatedAt', 'status', 'queuePosition'],
      filterable: ['tablePreference', 'status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'waitlist-restaurants',
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

    email: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().email().max(255),
        message: {
          max: 'Email must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.internet.email(),
    },

    phone: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          max: 'Phone number must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.phone.number(),
    },

    partySize: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
        message: {
          min: 'Party size must be at least 1',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 20 }),
    },

    checkInTime: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.timestamp().required(),
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    tablePreference: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.enum(['indoor', 'bar', 'booth', 'no_preference']).required(),
      },
      factory: faker => faker.helpers.arrayElement(['indoor', 'bar', 'booth', 'no_preference']),
    },

    status: {
      default: 'waiting',
      order: 7,
      fillable: true,
      validation: {
        rule: schema.enum(['waiting', 'seated', 'cancelled', 'no_show']).required(),
      },
      factory: faker => faker.helpers.arrayElement(['waiting', 'seated', 'cancelled', 'no_show']),
    },

    quoted_wait_time: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
        message: {
          min: 'Quoted wait time must be at least 0 minutes',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 120 }),
    },

    actual_wait_time: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Actual wait time must be at least 0 minutes',
        },
      },
      factory: faker => faker.helpers.maybe(() => faker.number.int({ min: 0, max: 180 }), { probability: 0.7 }),
    },

    queue_position: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
        message: {
          min: 'Queue position must be at least 1',
        },
      },
      factory: faker => faker.helpers.maybe(() => faker.number.int({ min: 1, max: 50 }), { probability: 0.7 }),
    },

    seatedAt: {
      order: 11,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    noShowAt: {
      order: 12,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    cancelledAt: {
      order: 13,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
