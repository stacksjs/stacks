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
      displayable: ['id', 'code', 'initialBalance', 'currentBalance', 'status', 'expiryDate', 'isActive'],
      searchable: ['code', 'recipientName', 'recipientEmail', 'purchaserId'],
      sortable: ['createdAt', 'expiryDate', 'initialBalance', 'currentBalance'],
      filterable: ['status', 'isDigital', 'isReloadable', 'isActive'],
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
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(50),
        message: {
          max: 'Code must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.string.alphanumeric(12).toUpperCase(),
    },

    initialBalance: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0.01),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 10, max: 200, dec: 2 })),
    },

    currentBalance: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
      },
      factory: () => 1,
    },

    currency: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().max(3),
      },
      factory: faker => faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'CAD', 'AUD']),
    },

    status: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['ACTIVE', 'USED', 'EXPIRED', 'DEACTIVATED']),
    },

    purchaser_id: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.string.uuid(),
    },

    recipient_email: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().email(),
      },
      factory: faker => faker.helpers.maybe(() => faker.internet.email(), { probability: 0.7 }),
    },

    recipientName: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.person.fullName(), { probability: 0.6 }),
    },

    personalMessage: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    },

    isDigital: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.8 }), // 80% digital
    },

    isReloadable: {
      order: 11,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.3 }), // 30% reloadable
    },

    isActive: {
      order: 12,
      fillable: true,
      default: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.9 }), // 90% active
    },

    expiryDate: {
      order: 13,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
        message: {
          timestamp: 'Expiry date must be a valid timestamp',
        },
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    lastUsedDate: {
      order: 14,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
        message: {
          timestamp: 'Last used date must be a valid timestamp',
        },
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    templateId: {
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
