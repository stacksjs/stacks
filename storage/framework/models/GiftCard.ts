import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'GiftCard',
  table: 'gift_cards',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'code', 'initial_balance', 'current_balance', 'status', 'expiry_date', 'is_active'],
      searchable: ['code', 'recipient_name', 'recipient_email', 'purchaser_id'],
      sortable: ['created_at', 'expiry_date', 'initial_balance', 'current_balance'],
      filterable: ['status', 'is_digital', 'is_reloadable', 'is_active'],
    },

    useSeeder: {
      count: 20,
    },

    useApi: {
      uri: 'gift-cards',
    },

    observe: true,
  },

  belongsTo: ['Customer'],
  hasMany: ['Order'],

  attributes: {
    code: {
      required: true,
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(50),
        message: {
          maxLength: 'Code must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.string.alphanumeric(12).toUpperCase(),
    },

    initial_balance: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().min(0.01),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 10, max: 200, dec: 2 })),
    },

    current_balance: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: () => 1,
    },

    currency: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(3),
      },
      factory: faker => faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'CAD', 'AUD']),
    },

    status: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.arrayElement(['ACTIVE', 'USED', 'EXPIRED', 'DEACTIVATED']),
    },

    purchaser_id: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.string.uuid(),
    },

    recipient_email: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().email(),
      },
      factory: faker => faker.helpers.maybe(() => faker.internet.email(), { probability: 0.7 }),
    },

    recipient_name: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.person.fullName(), { probability: 0.6 }),
    },

    personal_message: {
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    },

    is_digital: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.8 }), // 80% digital
    },

    is_reloadable: {
      required: false,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.3 }), // 30% reloadable
    },

    is_active: {
      required: false,
      order: 12,
      fillable: true,
      default: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.9 }), // 90% active
    },

    expiry_date: {
      required: false,
      order: 13,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: (faker) => {
        const now = new Date()
        const yearOffset = faker.number.int({ min: 1, max: 3 })
        const futureDate = new Date(now.setFullYear(now.getFullYear() + yearOffset))
        return futureDate.getTime()
      },
    },

    last_used_date: {
      required: false,
      order: 14,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.helpers.maybe(() => faker.date.recent().getTime(), { probability: 0.3 }),
    },

    template_id: {
      required: false,
      order: 15,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.5 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
