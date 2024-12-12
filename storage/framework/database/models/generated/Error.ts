import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'

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
      order: 1,
      fillable: true,

      factory: () => faker.system.fileType(),
    },

    message: {
      required: true,
      order: 2,
      fillable: true,

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
