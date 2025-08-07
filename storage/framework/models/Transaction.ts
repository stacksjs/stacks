import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Transaction',
  table: 'transactions',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'orderId', 'amount', 'status', 'paymentMethod', 'createdAt'],
      searchable: ['id', 'orderId', 'status', 'paymentMethod', 'transactionReference'],
      sortable: ['createdAt', 'amount'],
      filterable: ['status', 'paymentMethod'],
    },

    useSeeder: {
      count: 20,
    },

    useApi: {
      uri: 'transactions',
    },

    observe: true,
  },

  belongsTo: ['Order'],

  attributes: {
    amount: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0.01),
      },
      factory: faker => faker.number.int({ min: 5, max: 500 }),
    },

    status: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
    },

    paymentMethod: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'WALLET']),
    },

    paymentDetails: {
      order: 5,
      fillable: true,
      hidden: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        const paymentMethod = faker.helpers.arrayElement(['CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'WALLET'])

        let details
        if (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') {
          details = {
            last4: faker.finance.creditCardNumber('####'),
            expiry: `${faker.date.future().getMonth() + 1}/${String(faker.date.future().getFullYear()).slice(-2)}`,
            brand: faker.helpers.arrayElement(['Visa', 'Mastercard', 'Amex', 'Discover']),
          }
        }
        else if (paymentMethod === 'WALLET') {
          details = {
            wallet_id: faker.string.uuid(),
            transaction_id: faker.string.alphanumeric(12),
          }
        }
        else {
          details = {
            receipt_number: faker.string.alphanumeric(8).toUpperCase(),
          }
        }

        return JSON.stringify(details)
      },
    },

    transactionReference: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.string.alphanumeric(16).toUpperCase(),
    },

    loyaltyPointsEarned: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },

    loyaltyPointsRedeemed: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 50 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
