import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Websocket',
  table: 'websockets',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'websockets',
      routes: ['index', 'store', 'show'],
    },
    observe: true,
  },

  attributes: {
    type: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.enum(['disconnection', 'error', 'success']),
        message: {
          in: 'Type must be one of: disconnection, error, success',
        },
      },
    },

    socket: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().min(1).max(255),
        message: {
          min: 'Socket identifier must be provided',
          max: 'Socket identifier must not exceed 255 characters',
        },
      },
    },

    details: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().min(1).max(1000),
        message: {
          min: 'Details must be provided',
          max: 'Details must not exceed 1000 characters',
        },
      },
    },

    time: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          date: 'Time must be a valid timestamp',
        },
      },
    },
  },
} satisfies Model
