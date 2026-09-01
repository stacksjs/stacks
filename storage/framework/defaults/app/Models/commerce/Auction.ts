import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * An auction: a catalogue of lots that opens, takes bids, and closes.
 *
 * `eventId` is a plain column rather than a `belongsTo`, because the thing an
 * auction hangs off is the application's own event model - a gala, a fun run,
 * a capital campaign evening - and the framework does not ship one. An app that
 * has an Event model declares `hasOne: ['Auction']` on its side and the column
 * below is what that resolves through; an app with no events leaves it null and
 * runs the auction standalone.
 */
export default defineModel({
  name: 'Auction',
  table: 'auctions',
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
      displayable: ['id', 'title', 'status', 'opensAt', 'closesAt', 'goalAmount'],
      searchable: ['title', 'description'],
      sortable: ['createdAt', 'opensAt', 'closesAt'],
      filterable: ['status'],
    },

    useApi: {
      uri: 'auctions',
      middleware: { read: ['auth'], write: ['auth'] },
    },

    observe: true,
  },

  hasMany: ['AuctionItem', 'Bid', 'Pledge'],

  indexes: [
    { name: 'auctions_event_id_index', columns: ['event_id'] },
    { name: 'auctions_status_index', columns: ['status'] },
  ],

  attributes: {
    eventId: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 20 }),
    },

    title: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().max(160),
        message: {
          required: 'Title is required',
          max: 'Title must have a maximum of 160 characters',
        },
      },
      factory: () => 'Spring Benefit Auction',
    },

    description: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.sentence(),
    },

    status: {
      default: 'draft',
      order: 4,
      fillable: true,
      validation: {
        rule: schema.enum(['draft', 'preview', 'open', 'closed', 'settled']).required(),
        message: {
          required: 'Status is required',
        },
      },
      factory: () => 'draft',
    },

    currency: {
      default: 'USD',
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().max(3),
      },
      factory: () => 'USD',
    },

    /**
     * The fundraising target, in cents. Null when the school would rather not
     * put a number on the wall.
     */
    goalAmount: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 500000, max: 5000000 }),
    },

    opensAt: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.date().required(),
      },
      factory: faker => faker.date.soon().toISOString(),
    },

    closesAt: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.date().required(),
      },
      factory: faker => faker.date.future().toISOString(),
    },

    /** How far a lot's close is pushed out when a bid lands in the window. */
    antiSnipeMinutes: {
      default: 2,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(60),
      },
      factory: () => 2,
    },

    /** How close to the end a bid has to land to trigger an extension. */
    extendOnBidWindowMinutes: {
      default: 2,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(60),
      },
      factory: () => 2,
    },

    /**
     * The hard stop. Without it two determined bidders can hold one lot open
     * all night and the gala staff cannot go home.
     */
    maxExtensions: {
      default: 20,
      order: 11,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: () => 20,
    },
  },

  dashboard: {
    icon: 'i-hugeicons-auction',
    label: 'Auctions',
  },
} as const)
