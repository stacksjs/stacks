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
        rule: schema.string().in(['disconnection', 'error', 'success']),
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
        rule: schema.string().minLength(1).maxLength(255),
        message: {
          minLength: 'Socket identifier must be provided',
          maxLength: 'Socket identifier must not exceed 255 characters',
        },
      },
    },

    details: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().minLength(1).maxLength(1000),
        message: {
          minLength: 'Details must be provided',
          maxLength: 'Details must not exceed 1000 characters',
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
