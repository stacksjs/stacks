import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * One position fix from a driver's device.
 *
 * The append-only history behind `drivers.latitude/longitude`. A tracking map
 * needs the present position, but everything else about a delivery needs the
 * series: drawing the path already travelled, replaying a disputed drop,
 * measuring how long a stop actually took, and deriving an ETA from recent
 * speed rather than straight-line distance.
 *
 * Deliberately not `useSearch` (indexing a row every few seconds is pointless
 * and expensive) and not `useApi` (writes come through
 * `recordDriverPing`, which does the fan-out, and reads are scoped to a
 * route). `usePrunable` keeps the table from growing without bound.
 */
export default defineModel({
  name: 'DriverPing',
  table: 'driver_pings',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  belongsTo: ['Driver', 'DeliveryRoute'],

  attributes: {
    latitude: {
      order: 1,
      required: true,
      fillable: true,
      validation: {
        rule: schema.number().required().min(-90).max(90),
        message: {
          min: 'Latitude must be between -90 and 90',
          max: 'Latitude must be between -90 and 90',
        },
      },
      factory: faker => faker.location.latitude(),
    },

    longitude: {
      order: 2,
      required: true,
      fillable: true,
      validation: {
        rule: schema.number().required().min(-180).max(180),
        message: {
          min: 'Longitude must be between -180 and 180',
          max: 'Longitude must be between -180 and 180',
        },
      },
      factory: faker => faker.location.longitude(),
    },

    /** Degrees clockwise from true north. */
    heading: {
      order: 3,
      fillable: true,
      validation: { rule: schema.number().min(0).max(360) },
      factory: faker => faker.number.int({ min: 0, max: 359 }),
    },

    /** Metres per second. */
    speed: {
      order: 4,
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 30 }),
    },

    /**
     * Reported horizontal accuracy in metres. Worth keeping: a fix with 800m
     * of error should move the marker differently than one with 5m, and
     * without this the map cannot tell them apart.
     */
    accuracy: {
      order: 5,
      fillable: true,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 3, max: 60 }),
    },

    /**
     * When the device took the fix, which is not when the server received it.
     * A driver through a tunnel sends five fixes at once on the far side, and
     * ordering them by arrival draws a path that never happened.
     */
    recordedAt: {
      order: 6,
      required: true,
      fillable: true,
      validation: { rule: schema.timestamp().required() },
      factory: () => new Date().toISOString(),
    },
  },
} as const)
