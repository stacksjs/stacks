import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

/**
 * One person's place on a team license.
 *
 * A team license covers `seats` people. Each seat belongs to a member of the
 * license's team (`TeamMember`), is found by that member's email when they
 * activate a device, and allows the license's `maxDevices` devices of its own.
 */
export default defineModel({
  name: 'LicenseSeat',
  table: 'license_seats',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'license_seats_license_user_unique',
      columns: ['license_key_id', 'user_id'],
      unique: true,
    },
  ],

  // Assigned by a team's owner or admin through the license routes.
  ownership: false,

  belongsTo: ['LicenseKey', 'TeamMember', 'User'],

  traits: {
    gdpr: { erasure: 'delete', basis: 'contract', purpose: 'License seat assignment' },
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  attributes: {
    /** The member's address when the seat was assigned, lower-cased. */
    email: {
      required: true,
      fillable: true,
      personal: true,
      validation: {
        rule: schema.string().required().max(254),
      },
    },
    assignedAt: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.timestamp().required(),
      },
    },
  },

  dashboard: { enabled: false },
} as const)
