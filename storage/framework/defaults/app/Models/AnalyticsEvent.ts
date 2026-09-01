import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'AnalyticsEvent',
  table: 'analytics_events',
  primaryKey: 'id',
  autoIncrement: true,

  // An infrastructure table: rows are written by the system, not on behalf of a
  // caller, so no row has a per-caller owner to scope by. Writes are gated by
  // `middleware` instead. Declared rather than left silent (stacksjs/stacks#2375).
  ownership: false,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'analytics-events',
      routes: ['index', 'store', 'show', 'destroy'],
      middleware: ['auth'],
    },
    observe: true,
  },

  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
      },
    },

    category: {
      required: true,
      fillable: true,
      default: 'custom',
      validation: {
        rule: schema.string().required().max(50),
      },
    },

    path: {
      fillable: true,
      validation: {
        rule: schema.string().max(2048),
      },
    },

    value: {
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
    },

    currency: {
      required: true,
      fillable: true,
      default: 'USD',
      validation: {
        rule: schema.string().required().max(3),
      },
    },

    properties: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },
  },
} as const)
