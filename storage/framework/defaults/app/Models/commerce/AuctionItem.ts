import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * One lot in an auction.
 *
 * Every money column is integer cents. A benefit auction adds several hundred
 * bids together and reports the total to a board; floats lose that argument.
 */
export default defineModel({
  name: 'AuctionItem',
  table: 'auction_items',
  primaryKey: 'id',
  autoIncrement: true,

  // A reference table: no row here has a per-caller owner, so there is nothing
  // to scope by and writes are an administrative concern gated by `middleware`.
  // Declared rather than left silent so `security.api.rowScoping: 'deny'` can
  // tell "considered" from "nobody thought about it" (stacksjs/stacks#2375).
  ownership: false,

  traits: {
    useUuid: true,
    useTimestamps: true,

    useSearch: {
      displayable: ['id', 'lotNumber', 'title', 'status', 'startingBid', 'donorName'],
      searchable: ['title', 'description', 'donorName', 'category'],
      sortable: ['lotNumber', 'startingBid', 'closesAt'],
      filterable: ['status', 'category'],
    },

    useApi: {
      uri: 'auction-items',
      middleware: { read: ['auth'], write: ['auth'] },
    },

    observe: true,
  },

  belongsTo: ['Auction'],
  hasMany: ['Bid'],

  indexes: [
    { name: 'auction_items_auction_id_index', columns: ['auction_id'] },
    { name: 'auction_items_status_index', columns: ['status'] },
  ],

  attributes: {
    lotNumber: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
        message: {
          required: 'Lot number is required',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 120 }),
    },

    title: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().max(160),
        message: {
          required: 'Title is required',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    description: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.paragraph(),
    },

    imageUrl: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
      },
      factory: () => '',
    },

    category: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().max(60),
      },
      factory: faker => faker.helpers.arrayElement(['experiences', 'travel', 'dining', 'sports', 'art', 'services']),
    },

    /** Who donated the lot. It goes on the tax letter and the thank-you note. */
    donorName: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string().max(160),
      },
      factory: faker => faker.company.name(),
    },

    /**
     * What the lot is worth, in cents. Drives the sell-through report and the
     * "paid over value" number the development office cares about.
     */
    fairMarketValue: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 5000, max: 200000 }),
    },

    startingBid: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
        message: {
          required: 'Starting bid is required',
        },
      },
      factory: faker => faker.number.int({ min: 2500, max: 50000 }),
    },

    /**
     * A fixed increment for this lot, in cents. Null - the normal case - means
     * the auction-wide ladder applies, which steps bigger as the money gets
     * bigger.
     */
    minIncrement: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: () => null,
    },

    /** Bid at or above this and the lot sells immediately. */
    buyNowPrice: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: () => null,
    },

    /** Below this the lot passes rather than selling. */
    reservePrice: {
      order: 11,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: () => null,
    },

    status: {
      default: 'open',
      order: 12,
      fillable: true,
      validation: {
        rule: schema.enum(['open', 'closed', 'sold', 'passed']).required(),
      },
      factory: () => 'open',
    },

    /**
     * A per-lot close, so a gala can stagger its sections and the room is not
     * asked to watch a hundred lots end at once. Null falls back to the
     * auction's own close. Anti-snipe extensions are written here.
     */
    closesAt: {
      order: 13,
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: () => null,
    },

    /** How many times anti-snipe has already extended this lot. */
    extensionCount: {
      default: 0,
      order: 14,
      fillable: false,
      validation: {
        rule: schema.number().min(0),
      },
      factory: () => 0,
    },
  },

  dashboard: {
    icon: 'i-hugeicons-package',
    label: 'Lots',
  },
} as const)
