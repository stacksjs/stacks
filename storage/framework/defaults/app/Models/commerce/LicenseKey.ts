import { customerOwnership, defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * A software license: a key a customer was sold or handed, what it entitles
 * them to, and where it stands.
 *
 * The same row serves two uses. As a deliverable it is a key attached to an
 * order (the dashboard's license keys, `template`, `expiryDate`). As a license
 * for an app (`@stacksjs/commerce` `licensing`) it also carries a `tier`, the
 * last release it unlocks (`updatesUntil`, null for every release), how many
 * devices and seats it covers, and the purchase it was issued for.
 */
export default defineModel({
  name: 'LicenseKey',
  table: 'license_keys',
  primaryKey: 'id',
  autoIncrement: true,

  // Rows belong to the caller's customer record, one hop from the user
  // (stacksjs/stacks#2375). Without this the generated writes are reachable by
  // any authenticated caller for any row.
  ownership: customerOwnership(),

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'key', 'template', 'tier', 'expiryDate', 'updatesUntil', 'status'],
      searchable: ['key', 'email'],
      sortable: ['template', 'tier', 'expiryDate', 'updatesUntil', 'status', 'createdAt', 'updatedAt'],
      filterable: ['status', 'template', 'tier'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'license-keys',
      middleware: ['auth'],
    },

    observe: true,
  },

  belongsTo: ['Customer', 'Product', 'Order', 'Team'],
  hasMany: ['LicenseActivation', 'LicenseSeat'],

  attributes: {
    key: {
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().matches(/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){4}$/).required(),
        message: {
          matches: 'License key must be in the format XXXX-XXXX-XXXX-XXXX-XXXX',
        },
      },
      factory: (faker) => {
        const generateBlock = () => faker.string.alphanumeric({ length: 4, casing: 'upper' })
        return `${generateBlock()}-${generateBlock()}-${generateBlock()}-${generateBlock()}-${generateBlock()}`
      },
    },

    template: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.enum(['Standard License', 'Premium License', 'Enterprise License']).required(),
      },
      factory: faker => faker.helpers.arrayElement(['Standard License', 'Premium License', 'Enterprise License']),
    },

    // Null for a license that never ends: standard and lifetime are owned
    // outright, and only `updatesUntil` limits what a standard one unlocks.
    expiryDate: {
      order: 3,
      fillable: true,
      nullable: true,
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

    status: {
      default: 'unassigned',
      order: 4,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive', 'unassigned', 'revoked', 'refunded']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive', 'unassigned']),
    },

    /** What was bought: a year of updates, every update, or seats for a team. */
    tier: {
      default: 'standard',
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['standard', 'lifetime', 'team']),
      },
      factory: () => 'standard',
    },

    /**
     * The last release date this license unlocks. Builds released on or before
     * it stay unlocked for good; null unlocks every build.
     */
    updatesUntil: {
      order: 6,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.timestamp(),
      },
    },

    /** Devices one holder may have active at once. */
    maxDevices: {
      default: 2,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
    },

    /** People a team license covers. One for a personal license. */
    seats: {
      default: 1,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
    },

    /** Where the key is sent, and the address a resend is asked for. */
    email: {
      order: 9,
      fillable: true,
      nullable: true,
      personal: true,
      validation: {
        rule: schema.string().max(254),
      },
    },

    /**
     * Your reference for the purchase this license was issued for, echoed by
     * the payment provider's webhook. Unique, so a purchase issues one license
     * however many times its events arrive.
     */
    purchaseReference: {
      order: 10,
      fillable: true,
      nullable: true,
      unique: true,
      validation: {
        rule: schema.string().max(255),
      },
    },

    /** The provider's id for the payment, which is what a refund names. */
    paymentReference: {
      order: 11,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },

    /** The payment driver the purchase came through. */
    provider: {
      order: 12,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.string().max(64),
      },
    },

    /** Minor units (cents). */
    amountPaid: {
      order: 13,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.number().min(0),
      },
    },

    /** Minor units (cents). A license is revoked once this covers `amountPaid`. */
    amountRefunded: {
      default: 0,
      order: 14,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
    },

    currency: {
      order: 15,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.string().max(3),
      },
    },

    revokedAt: {
      order: 16,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.timestamp(),
      },
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
