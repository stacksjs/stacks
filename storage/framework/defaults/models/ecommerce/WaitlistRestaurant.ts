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
      displayable: ['id', 'name', 'email', 'phone', 'party_size', 'check_in_time', 'table_preference', 'status', 'quoted_wait_time', 'actual_wait_time', 'queue_position'],
      searchable: ['name', 'email', 'phone'],
      sortable: ['name', 'party_size', 'check_in_time', 'created_at', 'updated_at', 'status', 'queue_position'],
      filterable: ['table_preference', 'status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'waitlist-restaurants',
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

    email: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().email().maxLength(255),
        message: {
          maxLength: 'Email must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.internet.email(),
    },

    phone: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Phone number must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.phone.number(),
    },

    party_size: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
        message: {
          min: 'Party size must be at least 1',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 20 }),
    },

    check_in_time: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.date.future().toISOString(),
    },

    table_preference: {
      required: true,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.enum(['indoor', 'bar', 'booth', 'no_preference'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['indoor', 'bar', 'booth', 'no_preference']),
    },

    status: {
      required: true,
      default: 'waiting',
      order: 7,
      fillable: true,
      validation: {
        rule: schema.enum(['waiting', 'seated'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['waiting', 'seated']),
    },

    quoted_wait_time: {
      required: true,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Quoted wait time must be at least 0 minutes',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 120 }),
    },

    actual_wait_time: {
      required: false,
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
      required: false,
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
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
