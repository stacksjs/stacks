import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Coupon',
  table: 'coupons',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'code', 'discountType', 'discountValue', 'startDate', 'endDate'],
      searchable: ['code', 'description', 'discountType'],
      sortable: ['createdAt', 'startDate', 'endDate', 'discountValue', 'usageCount'],
      filterable: ['discountType'],
    },

    useSeeder: {
      count: 15,
    },

    useApi: {
      uri: 'coupons',
    },

    observe: true,
  },

  belongsTo: ['Product'],
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
      factory: faker => faker.string.alphanumeric(8).toUpperCase(),
    },

    description: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.commerce.productDescription(),
    },

    discountType: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.enum(['fixed_amount', 'percentage']).required(),
        message: {
          required: 'Discount type is required',
        },
      },
      factory: faker => faker.helpers.arrayElement(['fixed_amount', 'percentage']),
    },

    discountValue: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0.01),
        message: {
          required: 'Discount value is required',
          min: 'Discount value must be greater than 0.01',
        },
      },
      factory: faker => faker.number.float({ min: 5, max: 50 }),
    },

    minOrderAmount: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Min order amount must be greater than 0',
        },
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0, max: 50, dec: 2 })),
    },

    maxDiscountAmount: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Max discount amount must be greater than 0',
        },
      },
      factory: faker => faker.helpers.maybe(() => Number.parseFloat(faker.commerce.price({ min: 5, max: 100, dec: 2 })), { probability: 0.7 }),
    },

    freeProductId: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.3 }),
    },

    status: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.enum(['Active', 'Scheduled', 'Expired']),
        message: {
          required: 'Status is required',
        },
      },
      factory: faker => faker.helpers.arrayElement(['Active', 'Scheduled', 'Expired']),
    },

    usageLimit: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
        message: {
          min: 'Usage limit must be greater than 1',
        },
      },
      factory: faker => faker.helpers.maybe(() => faker.number.int({ min: 1, max: 100 }), { probability: 0.6 }),
    },

    usageCount: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Usage count must be greater than 0',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 50 }),
    },

    startDate: {
      order: 11,
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: faker => faker.date.recent().toISOString().slice(0, 10),
    },

    endDate: {
      order: 12,
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: faker => faker.date.future().toISOString().slice(0, 10),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
