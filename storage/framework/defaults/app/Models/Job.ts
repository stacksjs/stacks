import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Job',
  table: 'jobs',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: {
      count: 15,
    },
  },

  attributes: {
    queue: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          max: 'Queue must have a maximum of 255 characters',
        },
      },
      factory: () => 'default',
    },

    payload: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: () => JSON.stringify({
        jobName: 'ExampleJob',
        payload: {},
        options: { tries: 3 },
        envelopeVersion: 1,
        dispatchedAt: new Date().toISOString(),
      }),
    },

    attempts: {
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'attempts must be a number',
        },
      },
      factory: () => 0,
    },

    available_at: {
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: () => Math.floor(Date.now() / 1000),
    },
    reserved_at: {
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: () => null,
    },
  },
} as const)
