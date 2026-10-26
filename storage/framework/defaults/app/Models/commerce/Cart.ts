import { customerOwnership, defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'Cart',
  table: 'carts',
  primaryKey: 'id',
  autoIncrement: true,

  // Rows belong to the caller's customer record, one hop from the user
  // (stacksjs/stacks#2375). Without this the generated writes are reachable by
  // any authenticated caller for any row.
  ownership: customerOwnership(),

  traits: {
    gdpr: { subject: { via: 'Customer' }, erasure: 'anonymize', basis: 'contract', purpose: 'Shopping cart' },
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'customerId', 'status', 'totalItems', 'subtotal', 'total', 'expiresAt'],
      searchable: ['id', 'customerId', 'status'],
      sortable: ['createdAt', 'updatedAt', 'expiresAt', 'total'],
      filterable: ['status', 'customerId'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'carts',
      middleware: ['auth'],
    },

    observe: true,
  },

  hasMany: ['CartItem'],
  belongsTo: ['Customer', 'Coupon'],

  attributes: {
    status: {
      default: 'active',
      order: 1,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'abandoned', 'converted', 'expired']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'abandoned', 'converted', 'expired']),
    },

    totalItems: {
      default: 0,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 20 }),
    },

    subtotal: {
      default: 0,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      // Integer minor units, like every commerce amount: 1999 is $19.99.
      factory: faker => faker.number.int({ min: 1000, max: 20000 }),
    },

    taxAmount: {
      default: 0,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 1500 }),
    },

    discountAmount: {
      default: 0,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 1000 }),
    },

    total: {
      default: 0,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 1000, max: 21500 }),
    },

    expiresAt: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.timestamp().required(),
      },
      factory: (faker) => {
        const date = faker.date.past()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    currency: {
      default: 'USD',
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string().max(3),
      },
      factory: faker => faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'JPY', 'AUD']),
    },

    notes: {
      personal: true,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().max(1000),
      },
      factory: faker => faker.lorem.sentence(),
    },

    appliedCouponId: {
      order: 10,
      fillable: true,
      validation: {
        // Optional: a cart without a coupon is the common case.
        rule: schema.string(),
      },
      // Stored and shown, never resolved: nothing redeems or joins on it yet,
      // so what it holds is left to the feature that does. No factory, so a
      // seed does not invent one (stacksjs/stacks#3002).
    },

    // The storefront's anonymous cart: the shopper's signed stacks_cart cookie
    // carries this token, checkout records its progress and the address, and
    // the order is placed from them (stacksjs/stacks#3017). A cart made any
    // other way has none of them.

    /** Bearer for an anonymous cart, so never returned by the API. No factory: a seeded cart is no shopper's. */
    sessionToken: {
      order: 11,
      unique: true,
      hidden: true,
      validation: {
        rule: schema.string().max(255),
      },
    },

    checkoutStep: {
      default: 'cart',
      order: 12,
      fillable: true,
      validation: {
        rule: schema.enum(['cart', 'shipping', 'payment', 'placed']),
      },
    },

    email: {
      personal: true,
      order: 13,
      fillable: true,
      validation: {
        rule: schema.string().email().max(255),
      },
    },

    shippingName: {
      personal: true,
      order: 14,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },

    shippingAddress: {
      personal: true,
      order: 15,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },

    shippingCity: {
      personal: true,
      order: 16,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },

    shippingState: {
      personal: true,
      order: 17,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
      },
    },

    shippingZip: {
      personal: true,
      order: 18,
      fillable: true,
      validation: {
        rule: schema.string().max(20),
      },
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
