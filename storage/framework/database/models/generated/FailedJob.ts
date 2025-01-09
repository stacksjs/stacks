import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'
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
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Connection must have a maximum of 100 characters',
          string: 'Connection must be a string',
        },
      },
      factory: () => 'default',
    },
    
    queue: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'Queue must have a maximum of 255 characters',
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
      factory: () => faker.lorem.sentence(),
    },

    exception: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => faker.lorem.sentence(),
    },

    failed_at: {
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: () => '2024-12-23 13:32:19',
    }
  },
} satisfies Model
