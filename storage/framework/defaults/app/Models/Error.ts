import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'Error',
  table: 'errors',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'errors_created_at_index',
      columns: ['created_at'],
    },
  ],

  traits: {
    // So a fresh seed fills its dashboard page (stacksjs/stacks#3000).
    useSeeder: { count: 10 },
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
      type: 'text',
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
      type: 'text',
      validation: {
        rule: schema.string(),
        message: {
          string: 'stack must be a text',
        },
      },
      factory: faker => faker.system.filePath(),
    },

    /**
     * The HTTP status the error carried, and only that.
     *
     * It used to mean two things: the factory seeds an HTTP status while
     * `resolveGroup` wrote 1 and `ignoreGroup` wrote 2 into the same column
     * to mean resolved and ignored. So resolving an error destroyed its
     * status, and a seeded error could never read as resolved because no
     * factory row is ever 1 (stacksjs/stacks#2923). Triage now lives in
     * `resolution`.
     */
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

    /** Where this error sits in triage. Separate from `status`, see above. */
    resolution: {
      required: true,
      fillable: true,
      default: 'unresolved',
      validation: {
        rule: schema.enum(['unresolved', 'resolved', 'ignored']),
      },
      factory: () => 'unresolved',
    },

    additional_info: {
      fillable: true,
      type: 'text',
      validation: {
        rule: schema.string(),
        message: {
          string: 'additional_info must be a text',
        },
      },
      factory: faker => faker.lorem.paragraph(),
    },
  },
} as const)
