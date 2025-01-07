import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Error',
  table: 'errors',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    type: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'Queue must have a maximum characters of 255',
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

    stack: {
      order: 3,
      fillable: true,
      factory: () => faker.system.filePath(),
    },

    status: {
      required: true,
      order: 4,
      fillable: true,

      factory: () => faker.number.int({ min: 100, max: 599 }),
    },

    user_id: {
      order: 5,
      fillable: true,
      factory: () => faker.number.int({ min: 1, max: 100 }),
    },

    additional_info: {
      order: 6,
      fillable: true,
      factory: () => faker.lorem.paragraph(),
    },
  },
} satisfies Model
