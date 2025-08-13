import type { Model } from '@stacksjs/types'
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
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          max: 'type must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.system.fileType(),
    },

    message: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          string: 'message must be a string',
        },
      },
      factory: faker => faker.lorem.sentence(),
    },

    stack: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'stack must be a text',
        },
      },
      factory: faker => faker.system.filePath(),
    },

    status: {
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          string: 'status must be a number',
        },
      },
      factory: faker => faker.number.int({ min: 400, max: 500 }),
    },

    additional_info: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'additional_info must be a text',
        },
      },
      factory: faker => faker.lorem.paragraph(),
    },
  },
} satisfies Model
