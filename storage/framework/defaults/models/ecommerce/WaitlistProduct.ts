import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'WaitlistProduct',
  table: 'wait_list_products',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['Product', 'Customer'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'email', 'phone', 'party_size', 'notification_preference', 'source', 'notes'],
      searchable: ['name', 'email', 'phone', 'source'],
      sortable: ['name', 'party_size', 'created_at', 'updated_at'],
      filterable: ['notification_preference', 'source'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'waitlist-products',
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
        rule: schema.string().maxLength(100).optional(),
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
      factory: faker => faker.helpers.arrayElement(['website', 'social_media', 'referral', 'other']),
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
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
