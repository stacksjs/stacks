import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Payment',
  table: 'payments',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'order_id', 'customer_id', 'amount', 'method', 'status', 'date'],
      searchable: ['order_id', 'customer_id', 'reference_number'],
      sortable: ['amount', 'created_at'],
      filterable: ['method', 'status', 'date'],
    },

    useSeeder: {
      count: 50,
    },

    useApi: {
      uri: 'payments',
    },

    observe: true,
  },

  belongsTo: ['Order', 'Customer'], // For order_id and customer_id

  attributes: {
    amount: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0.01),
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 10, max: 500, dec: 2 })),
    },

    method: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.arrayElement([
        'credit_card',
        'debit_card',
        'paypal',
        'apple_pay',
        'google_pay',
        'bank_transfer',
        'gift_card',
      ]),
    },

    status: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.arrayElement([
        'pending',
        'processing',
        'completed',
        'failed',
        'refunded',
        'partially_refunded',
      ]),
    },

    currency: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(3),
      },
      factory: faker => faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'CAD', 'AUD']),
    },

    reference_number: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.string.alphanumeric(16).toUpperCase(),
    },

    card_last_four: {
      required: false,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(4),
      },
      factory: faker => faker.helpers.maybe(() => faker.finance.creditCardNumber('####'), { probability: 0.7 }),
    },

    card_brand: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.helpers.arrayElement(['Visa', 'Mastercard', 'Amex', 'Discover']), { probability: 0.7 }),
    },

    billing_email: {
      required: false,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.string().email(),
      },
      factory: faker => faker.helpers.maybe(() => faker.internet.email(), { probability: 0.8 }),
    },

    transaction_id: {
      required: false,
      order: 12,
      unique: true,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.9 }),
    },

    payment_provider: {
      required: false,
      order: 13,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.helpers.arrayElement(['stripe', 'paypal', 'square', 'braintree', 'authorize_net']), { probability: 0.9 }),
    },

    refund_amount: {
      required: false,
      order: 14,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.helpers.maybe(() => Number.parseFloat(faker.commerce.price({ min: 5, max: 100, dec: 2 })), { probability: 0.2 }),
    },

    notes: {
      required: false,
      order: 15,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
