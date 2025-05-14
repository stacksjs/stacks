import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'FailedJob',
  table: 'failed_jobs',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    connection: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          max: 'Connection must have a maximum of 100 characters',
          string: 'Connection must be a string',
        },
      },
      factory: () => 'default',
    },

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

    exception: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.sentence(),
    },

    failed_at: {
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: () => '2024-12-23 13:32:19',
    },
  },
} satisfies Model
