import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * One bid on one lot.
 *
 * Bidders are identified by name and email rather than by a user account: a
 * benefit auction is bid on by grandparents on borrowed phones, and requiring
 * a signup between them and their paddle costs the school real money.
 *
 * `maxAmount` is the private proxy ceiling. It must never be selected into a
 * template or an API response - the whole mechanism depends on nobody being
 * able to see how far the other side is willing to go. `hidden` keeps it out of
 * the generated CRUD responses; the queries in `@stacksjs/auctions` that feed
 * the public catalogue select columns explicitly for the same reason.
 */
export default defineModel({
  name: 'Bid',
  table: 'bids',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,

    useSearch: {
      displayable: ['id', 'bidderName', 'amount', 'status', 'placedAt'],
      searchable: ['bidderName', 'bidderEmail'],
      sortable: ['placedAt', 'amount'],
      filterable: ['status'],
    },

    // Read is authenticated: the bid history of a lot is staff information
    // while the auction is live. Writes never come through generated CRUD -
    // a bid has to go through the engine, so the app owns that route.
    useApi: {
      uri: 'bids',
      routes: ['index', 'show'],
      middleware: ['auth'],
    },

    observe: true,
  },

  belongsTo: ['Auction', 'AuctionItem'],

  indexes: [
    { name: 'bids_auction_item_id_index', columns: ['auction_item_id'] },
    { name: 'bids_auction_id_index', columns: ['auction_id'] },
    { name: 'bids_bidder_email_index', columns: ['bidder_email'] },
    { name: 'bids_status_index', columns: ['status'] },
  ],

  attributes: {
    bidderName: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(160),
        message: {
          required: 'Your name is required',
        },
      },
      factory: faker => faker.person.fullName(),
    },

    bidderEmail: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().email().required(),
        message: {
          required: 'Your email is required',
          email: 'That does not look like an email address',
        },
      },
      factory: faker => faker.internet.email().toLowerCase(),
    },

    /** The public number: what this bidder is currently committed to, in cents. */
    amount: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
        message: {
          required: 'A bid amount is required',
        },
      },
      factory: faker => faker.number.int({ min: 5000, max: 200000 }),
    },

    /** The private ceiling, in cents. Null means "this amount only". */
    maxAmount: {
      order: 4,
      fillable: true,
      hidden: true,
      validation: {
        rule: schema.number().min(1),
      },
      factory: () => null,
    },

    status: {
      default: 'leading',
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['leading', 'outbid', 'won', 'lost', 'invalid']).required(),
      },
      factory: () => 'outbid',
    },

    placedAt: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.date().required(),
      },
      factory: faker => faker.date.recent().toISOString(),
    },
  },

  dashboard: {
    icon: 'i-hugeicons-hand-pointing-right-01',
    label: 'Bids',
  },
} as const)
