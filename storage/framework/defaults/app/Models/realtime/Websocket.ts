import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Websocket',
  table: 'websockets',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: {
      count: 20,
    },
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
      factory: faker => faker.helpers.arrayElement(['success', 'success', 'success', 'disconnection', 'error']),
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
      factory: faker => faker.string.alphanumeric(20),
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
      factory: faker => faker.lorem.sentence(),
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
      factory: faker => faker.date.recent().getTime(),
    },
  },
} as const)
