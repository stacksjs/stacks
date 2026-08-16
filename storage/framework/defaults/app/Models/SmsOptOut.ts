import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A phone number that texted STOP. Keyed by NUMBER, not user - the reply
 * comes from a handset, and whoever holds it has spoken for it. Checked by
 * `notify()`'s sms channel on every non-emergency send; written and cleared
 * by `handleInboundSms()` (`@stacksjs/sms`).
 */
export default defineModel({
  name: 'SmsOptOut',
  table: 'sms_opt_outs',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'sms_opt_outs_phone_unique',
      columns: ['phone'],
      unique: true,
    },
  ],

  traits: {
    useTimestamps: true,
  },

  attributes: {
    /** E.164 where derivable (`+13105550199`). */
    phone: {
      required: true,
      order: 1,
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().min(7).max(20),
      },
      factory: faker => faker.phone.number(),
    },

    reason: {
      required: false,
      order: 2,
      fillable: true,
      default: 'stop-keyword',
      validation: {
        rule: schema.string().max(64),
      },
      factory: () => 'stop-keyword',
    },

    optedOutAt: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        const date = faker.date.recent()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },
  },
} as const)
