import type { Faker } from '@stacksjs/faker'
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
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'type must have a maximum of 255 characters',
        },
      },
      factory: (faker: Faker) => faker.system.fileType(),
    },

    message: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'message must be a string',
        },
      },
      factory: (faker: Faker) => faker.lorem.sentence(),
    },

    stack: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'stack must be a text',
        },
      },
      factory: (faker: Faker) => faker.system.filePath(),
    },

    status: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          string: 'status must be a number',
        },
      },
      factory: (faker: Faker) => faker.number.int({ min: 400, max: 500 }),
    },

    additional_info: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'additional_info must be a text',
        },
      },
      factory: (faker: Faker) => faker.lorem.paragraph(),
    },
  },
} satisfies Model
