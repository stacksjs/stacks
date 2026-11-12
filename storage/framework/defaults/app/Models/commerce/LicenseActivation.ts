import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * One device using a license.
 *
 * A license allows `maxDevices` of these at a time (per seat, for a team
 * license). The device is known only by the SHA-256 of an id the app chose,
 * plus the name its owner sees when the limit is reached. Releasing a device
 * sets `releasedAt` and frees its slot; activating it again clears it.
 */
export default defineModel({
  name: 'LicenseActivation',
  table: 'license_activations',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'license_activations_license_device_unique',
      columns: ['license_key_id', 'device_hash'],
      unique: true,
    },
  ],

  // Written by the license routes for a key holder, never for a signed-in caller.
  ownership: false,

  belongsTo: ['LicenseKey'],

  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  attributes: {
    /** SHA-256 of the device id, hex. */
    deviceHash: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().required().max(64),
      },
    },
    deviceName: {
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },
    platform: {
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.string().max(32),
      },
    },
    appVersion: {
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.string().max(64),
      },
    },
    /** The seat this device is activated under, for a team license. */
    licenseSeatId: {
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.number(),
      },
    },
    firstSeenAt: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.timestamp().required(),
      },
    },
    lastSeenAt: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.timestamp().required(),
      },
    },
    releasedAt: {
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.timestamp(),
      },
    },
  },

  dashboard: { enabled: false },
} as const)
