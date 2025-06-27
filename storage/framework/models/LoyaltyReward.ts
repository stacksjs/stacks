import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'LoyaltyReward',
  table: 'loyalty_rewards',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'pointsRequired', 'rewardType', 'isActive'],
      searchable: ['name', 'description', 'rewardType'],
      sortable: ['pointsRequired', 'createdAt', 'updatedAt'],
      filterable: ['rewardType', 'isActive'],
    },

    useSeeder: {
      count: 15,
    },

    useApi: {
      uri: 'loyalty-rewards',
    },

    observe: true,
  },

  belongsTo: ['Product'],

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement([
        `10% discount on your order`,
        `20% discount on your order`,
        `Free product with purchase`,
        `Priority delivery service`,
      ]),
    },

    description: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.paragraph(),
    },

    pointsRequired: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
      },
      factory: faker => faker.number.int({ min: 100, max: 5000 }),
    },

    rewardType: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['DISCOUNT', 'FREE_ITEM', 'PRIORITY_SERVICE']),
    },

    discountPercentage: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
      },
      factory: faker => faker.helpers.maybe(() => faker.number.int({ min: 5, max: 50 }), { probability: 0.6 }),
    },

    freeProductId: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.4 }),
    },

    isActive: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean({ probability: 0.9 }), // 90% active
    },

    expiryDays: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.helpers.arrayElement([7, 14, 30, 60, 90]),
    },

    imageUrl: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.image.url(),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
