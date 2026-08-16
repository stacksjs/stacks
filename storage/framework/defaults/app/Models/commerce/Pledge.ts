import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A fund-a-need pledge.
 *
 * Fund-a-need is the part of a benefit auction that is not an auction: the room
 * is asked to give at fixed levels and nobody competes for anything. It shares
 * the auction only for the tally board, which is why a pledge has an amount and
 * a level but no lot, no increment and no winner.
 */
export default defineModel({
  name: 'Pledge',
  table: 'pledges',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,

    useSearch: {
      displayable: ['id', 'donorName', 'amount', 'level', 'status'],
      searchable: ['donorName', 'donorEmail', 'level'],
      sortable: ['createdAt', 'amount'],
      filterable: ['status', 'level'],
    },

    useApi: {
      uri: 'pledges',
      middleware: ['auth'],
    },

    observe: true,
  },

  belongsTo: ['Auction'],

  indexes: [
    { name: 'pledges_auction_id_index', columns: ['auction_id'] },
    { name: 'pledges_status_index', columns: ['status'] },
  ],

  attributes: {
    donorName: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(160),
        message: {
          required: 'Donor name is required',
        },
      },
      factory: faker => faker.person.fullName(),
    },

    donorEmail: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().email().required(),
        message: {
          required: 'Donor email is required',
        },
      },
      factory: faker => faker.internet.email().toLowerCase(),
    },

    /** The gift, in cents. */
    amount: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
        message: {
          required: 'A pledge amount is required',
        },
      },
      factory: faker => faker.helpers.arrayElement([25000, 50000, 100000, 250000, 500000]),
    },

    /** The paddle-raise tier this came from, for the tally board. */
    level: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().max(40),
      },
      factory: faker => faker.helpers.arrayElement(['250', '500', '1000', '2500', '5000']),
    },

    /**
     * Pledges made from the room are good the moment a paddle goes up; pledges
     * taken online are often confirmed by staff afterwards. Only `confirmed`
     * money counts toward a total anybody reports.
     */
    status: {
      default: 'confirmed',
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['pending', 'confirmed', 'cancelled']).required(),
      },
      factory: () => 'confirmed',
    },
  },

  dashboard: {
    icon: 'i-hugeicons-give-blood',
    label: 'Pledges',
  },
} as const)
