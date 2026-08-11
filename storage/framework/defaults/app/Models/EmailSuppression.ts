import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'EmailSuppression',
  table: 'email_suppressions',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'email_suppressions_email_type_unique',
      columns: ['email', 'type'],
      unique: true,
    },
  ],

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'email-suppressions',
      routes: ['index', 'show', 'destroy'],
      middleware: ['auth'],
    },
  },

  attributes: {
    email: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().email().required().max(320),
      },
    },
    type: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.enum(['bounce', 'complaint', 'unsubscribe', 'manual']),
      },
    },
    reason: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(2000),
      },
    },
  },

  dashboard: { enabled: false },
} as const)
