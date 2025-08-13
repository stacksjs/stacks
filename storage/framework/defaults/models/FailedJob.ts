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
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Connection must have a maximum of 100 characters',
          string: 'Connection must be a string',
        },
      },
      factory: () => 'default',
    },

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
      factory: faker => faker.lorem.sentence(),
    },

    exception: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
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
