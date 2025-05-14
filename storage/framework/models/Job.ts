import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Job',
  table: 'jobs',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    queue: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          max: 'Queue must have a maximum of 255 characters',
        },
      },
      factory: () => 'default',
    },

    payload: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.sentence(),
    },

    attempts: {
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'attempts must be a number',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 10 }),
    },

    available_at: {
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1000000, max: 1999999 }),
    },
    reserved_at: {
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: () => '2024-12-23 13:32:19',
    },
  },
} satisfies Model
