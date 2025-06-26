import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'LoyaltyPoint',
  table: 'loyalty_points',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'walletId', 'points', 'source', 'description', 'expiryDate', 'isUsed'],
      searchable: ['description', 'source', 'sourceReferenceId'],
      sortable: ['createdAt', 'points', 'expiryDate'],
      filterable: ['walletId', 'source', 'isUsed'],
    },

    useSeeder: {
      count: 50,
    },

    useApi: {
      uri: 'loyalty-points',
    },

    observe: true,
  },

  attributes: {
    walletId: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.string.uuid(),
    },

    points: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
      },
      factory: faker => faker.number.int({ min: 1, max: 500 }),
    },

    source: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.arrayElement(['ORDER', 'PROMOTION', 'REFERRAL', 'MANUAL']),
    },

    sourceReferenceId: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.string.uuid(),
    },

    description: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.arrayElement([
        `Points earned from order #${faker.string.alphanumeric(8).toUpperCase()}`,
        `Bonus points from promotion`,
        `Referral bonus for inviting a friend`,
        `Manual adjustment by administrator`,
      ]),
    },

    expiryDate: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    isUsed: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.3 }), // 30% chance of being used
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
