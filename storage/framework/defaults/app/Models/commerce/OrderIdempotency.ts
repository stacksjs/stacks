import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'OrderIdempotency',
  table: 'order_idempotency',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  dashboard: { enabled: false },

  belongsTo: ['Order'],

  attributes: {
    idempotencyKey: {
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().required().max(255),
      },
    },
    orderId: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number().required(),
      },
    },
  },
} as const)
