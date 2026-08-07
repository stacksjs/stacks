import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * One address on a delivery route.
 *
 * `DeliveryRoute` records that a route happened and how far it went; this is
 * the route itself. Without it `stops` is an integer, which is enough to bill
 * a driver and not nearly enough to tell a customer where their order is: the
 * link from an order to the vehicle carrying it runs through here.
 *
 * Sequence is the planned order. `status` is what actually happened, which
 * diverges the moment a driver skips a building and comes back to it.
 */
export default defineModel({
  name: 'DeliveryStop',
  table: 'delivery_stops',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,

    useSearch: {
      displayable: ['id', 'sequence', 'status', 'address', 'etaAt'],
      searchable: ['address', 'recipientName'],
      sortable: ['sequence', 'etaAt', 'createdAt'],
      filterable: ['status', 'deliveryRouteId'],
    },

    useSeeder: { count: 0 },

    useApi: {
      // A stop names a customer and their address. Staff only, both ways.
      // Customers reach their own stop through the order tracking route,
      // which authorises on the order's tracking token instead.
      middleware: ['auth'],
      uri: 'delivery-stops',
    },

    observe: true,
  },

  belongsTo: ['DeliveryRoute', 'Order'],

  attributes: {
    /** Position in the planned run, 1-based. */
    sequence: {
      order: 1,
      required: true,
      fillable: true,
      default: 1,
      validation: {
        rule: schema.number().required().min(1),
        message: { min: 'Sequence starts at 1' },
      },
      factory: faker => faker.number.int({ min: 1, max: 20 }),
    },

    status: {
      order: 2,
      required: true,
      fillable: true,
      default: 'pending',
      validation: {
        rule: schema.enum(['pending', 'en_route', 'arrived', 'completed', 'failed', 'skipped']),
        message: {
          enum: 'Status must be one of: pending, en_route, arrived, completed, failed, skipped',
        },
      },
      factory: faker => faker.helpers.arrayElement(['pending', 'en_route', 'completed']),
    },

    address: {
      order: 3,
      required: true,
      fillable: true,
      validation: { rule: schema.string().required().max(255) },
      factory: faker => faker.location.streetAddress(true),
    },

    /**
     * Geocoded destination. Nullable because an address can arrive before it
     * resolves, and a stop with no coordinates is still a stop the driver can
     * complete; it just cannot be drawn.
     */
    latitude: {
      order: 4,
      fillable: true,
      validation: { rule: schema.number().min(-90).max(90) },
      factory: faker => faker.location.latitude(),
    },

    longitude: {
      order: 5,
      fillable: true,
      validation: { rule: schema.number().min(-180).max(180) },
      factory: faker => faker.location.longitude(),
    },

    recipientName: {
      order: 6,
      fillable: true,
      validation: { rule: schema.string().max(255) },
      factory: faker => faker.person.fullName(),
    },

    recipientPhone: {
      order: 7,
      fillable: true,
      validation: { rule: schema.string().max(40) },
      factory: faker => faker.phone.number(),
    },

    /** Current estimate, rewritten as the driver moves. */
    etaAt: {
      order: 8,
      fillable: true,
      validation: { rule: schema.timestamp() },
      factory: () => new Date(Date.now() + 25 * 60_000).toISOString(),
    },

    /**
     * When the customer was told the driver was close.
     *
     * The latch that makes "nearly there" fire once. Without it every ping
     * inside the radius sends another text, which is roughly one text every
     * four seconds for the last four hundred metres.
     */
    notifiedNearbyAt: {
      order: 9,
      fillable: true,
      validation: { rule: schema.timestamp() },
      factory: () => null,
    },

    /** When the driver crossed the arrival radius. */
    arrivedAt: {
      order: 10,
      fillable: true,
      validation: { rule: schema.timestamp() },
      factory: () => null,
    },

    /** When the handover finished. Together with `arrivedAt`, dwell time. */
    completedAt: {
      order: 11,
      fillable: true,
      validation: { rule: schema.timestamp() },
      factory: () => null,
    },

    /** Why a stop failed, or anything the driver needs to record. */
    notes: {
      order: 12,
      fillable: true,
      validation: { rule: schema.string().max(1000) },
      factory: () => '',
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
