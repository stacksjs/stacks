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
      displayable: ['id', 'orderId', 'customerId', 'amount', 'method', 'status', 'date'],
      searchable: ['orderId', 'customerId', 'referenceNumber'],
      sortable: ['amount', 'createdAt'],
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
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
      },
      factory: faker => faker.number.int({ min: 1000, max: 50000 }),
    },

    method: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement([
        'creditCard',
        'debitCard',
        'paypal',
        'applePay',
        'googlePay',
        'bankTransfer',
        'giftCard',
      ]),
    },

    status: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement([
        'pending',
        'processing',
        'completed',
        'failed',
        'refunded',
        'partiallyRefunded',
      ]),
    },

    currency: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().max(3),
      },
      factory: faker => faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'CAD', 'AUD']),
    },

    referenceNumber: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.string.alphanumeric(16).toUpperCase(),
    },

    cardLastFour: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().max(4),
      },
      factory: faker => faker.helpers.maybe(() => faker.finance.creditCardNumber('####'), { probability: 0.7 }),
    },

    cardBrand: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.helpers.arrayElement(['Visa', 'Mastercard', 'Amex', 'Discover']), { probability: 0.7 }),
    },

    billingEmail: {
      order: 11,
      fillable: true,
      validation: {
        rule: schema.string().email(),
      },
      factory: faker => faker.helpers.maybe(() => faker.internet.email(), { probability: 0.8 }),
    },

    transactionId: {
      order: 12,
      unique: true,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.9 }),
    },

    paymentProvider: {
      order: 13,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.maybe(() => faker.helpers.arrayElement(['stripe', 'paypal', 'square', 'braintree', 'authorizeNet']), { probability: 0.9 }),
    },

    refundAmount: {
      order: 14,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.helpers.maybe(() => faker.number.int({ min: 500, max: 10000 }), { probability: 0.2 }),
    },

    notes: {
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
