import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'WaitlistProduct',
  table: 'waitlist_products',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['Product', 'Customer'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'email', 'phone', 'party_size', 'notification_preference', 'source', 'notes', 'status'],
      searchable: ['name', 'email', 'phone', 'source'],
      sortable: ['name', 'party_size', 'created_at', 'updated_at', 'status'],
      filterable: ['notification_preference', 'source', 'status'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'waitlist-products',
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
        rule: schema.string().maxLength(100).optional(),
        message: {
          maxLength: 'Phone number must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.phone.number(),
    },

    quantity: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
        message: {
          min: 'Quantity must be at least 1',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 20 }),
    },

    notification_preference: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['sms', 'email', 'both'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['sms', 'email', 'both']),
    },

    source: {
      required: true,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Source must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement(['website', 'social_media', 'in-store', 'email', 'app', 'referral', 'other']),
    },

    notes: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().optional(),
      },
      factory: faker => faker.lorem.paragraph(),
    },

    status: {
      required: true,
      default: 'waiting',
      order: 8,
      fillable: true,
      validation: {
        rule: schema.enum(['waiting', 'purchased', 'notified', 'cancelled'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['waiting', 'purchased', 'notified', 'cancelled']),
    },

    notified_at: {
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.date.future().toISOString(), { probability: 0.7 }),
    },
    purchased_at: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.date.future().toISOString(), { probability: 0.7 }),
    },
    cancelled_at: {
      required: false,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.date.future().toISOString(), { probability: 0.7 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
