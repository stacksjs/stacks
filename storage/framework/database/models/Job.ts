import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'
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

    attempts: {
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'attempts must be a number',
        },
      },
      factory: () => faker.number.int({ min: 0, max: 10 }),
    },

    reserved_at: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.date(),
      },
      factory: () => '2024-12-23 13:32:19',
    },
  },
} satisfies Model
