import type { Faker } from '@stacksjs/faker'
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'LoyaltyReward',
  table: 'loyalty_rewards',
  primaryKey: 'id',
  autoIncrement: false, // Using UUID instead of auto-increment

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'points_required', 'reward_type', 'is_active'],
      searchable: ['name', 'description', 'reward_type'],
      sortable: ['points_required', 'created_at', 'updated_at'],
      filterable: ['reward_type', 'is_active'],
    },

    useSeeder: {
      count: 15,
    },

    useApi: {
      uri: 'loyalty-rewards',
      routes: ['index', 'store', 'show'],
    },

    observe: true,
  },

  belongsTo: ['Product'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.helpers.arrayElement([
        `10% discount on your order`,
        `20% discount on your order`,
        `Free product with purchase`,
        `Priority delivery service`,
      ]),
    },

    description: {
      required: false,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.lorem.paragraph(),
    },

    points_required: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
      factory: (faker: Faker) => faker.number.int({ min: 100, max: 5000 }),
    },

    reward_type: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.helpers.arrayElement(['DISCOUNT', 'FREE_ITEM', 'PRIORITY_SERVICE']),
    },

    discount_percentage: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
      },
      factory: (faker: Faker) => faker.helpers.maybe(() => faker.number.int({ min: 5, max: 50 }), { probability: 0.6 }),
    },

    free_product_id: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.4 }),
    },

    is_active: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: (faker: Faker) => faker.datatype.boolean({ probability: 0.9 }), // 90% active
    },

    expiry_days: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: (faker: Faker) => faker.helpers.arrayElement([7, 14, 30, 60, 90]),
    },

    image_url: {
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker: Faker) => faker.image.url(),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
